"use client";

import { useState, useCallback } from "react";
import { usePolling } from "@/hooks/use-polling";
import { usePortalSession } from "../layout";
import { StripeCardForm } from "@/components/shared/stripe-card-form";
import { CreditCard, TrendingUp, DollarSign, Calendar, CheckCircle2, Loader2, X, RotateCcw, Clock, Ban, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PortalPayment = {
  _id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  paidAt: number;
  type?: "appointment" | "case_fee";
  status: "Completed" | "Refunded" | "On Hold" | "Voided";
};

type ContractSummary = {
  contractAmountCents: number;
  totalPaidCents: number;
  outstandingCents: number;
  nextPaymentDate: number | null;
  currency: string;
  stripeEnabled: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function progressPercent(paid: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((paid / total) * 100));
}

// ─── Contract Summary Card ────────────────────────────────────────────────────

function ContractSummaryCard({
  summary,
  onPay,
}: {
  summary: ContractSummary;
  onPay: () => void;
}) {
  const pct = progressPercent(summary.totalPaidCents, summary.contractAmountCents);
  const hasOutstanding = summary.outstandingCents > 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Contract Fee</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Your total legal service fee and payment progress.</p>
        </div>
        {hasOutstanding && (
          <button
            onClick={summary.stripeEnabled ? onPay : undefined}
            disabled={!summary.stripeEnabled}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard className="h-4 w-4" />
            Make a Payment
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <DollarSign className="h-3.5 w-3.5" />
            Total Fee
          </div>
          <p className="text-xl font-bold text-foreground">
            {formatCurrency(summary.contractAmountCents, summary.currency)}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <TrendingUp className="h-3.5 w-3.5" />
            Paid
          </div>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(summary.totalPaidCents, summary.currency)}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <CreditCard className="h-3.5 w-3.5" />
            Outstanding
          </div>
          <p className={`text-xl font-bold ${hasOutstanding ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {formatCurrency(summary.outstandingCents, summary.currency)}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{pct}% paid</span>
          {summary.nextPaymentDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Next payment due {formatDate(summary.nextPaymentDate)}
            </span>
          )}
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!hasOutstanding && summary.contractAmountCents > 0 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Fully paid — thank you!
        </div>
      )}
    </div>
  );
}

// ─── Payment Dialog ───────────────────────────────────────────────────────────

function PaymentDialog({
  summary,
  onClose,
  onSuccess,
}: {
  summary: ContractSummary;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amountInput, setAmountInput] = useState("");
  const [nextPaymentDate, setNextPaymentDate] = useState("");
  const [step, setStep] = useState<"form" | "card" | "done">("form");
  const [clientSecret, setClientSecret] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [currency, setCurrency] = useState(summary.currency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxDate = new Date(Date.now() + 60 * 24 * 60 * 60_000).toISOString().split("T")[0];
  const minDate = new Date(Date.now() + 24 * 60 * 60_000).toISOString().split("T")[0];
  const maxAmountDollars = (summary.outstandingCents / 100).toFixed(2);
  const amountCents = Math.round(parseFloat(amountInput || "0") * 100);

  async function handleFormNext() {
    setError(null);
    if (!amountInput || isNaN(parseFloat(amountInput)) || parseFloat(amountInput) < 1) {
      setError("Please enter a valid amount (minimum 1.00).");
      return;
    }
    if (amountCents > summary.outstandingCents) {
      setError(`Amount cannot exceed your outstanding balance of ${formatCurrency(summary.outstandingCents, summary.currency)}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/portal/payments/case-fee-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          nextPaymentDate: nextPaymentDate ? new Date(nextPaymentDate).getTime() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Checkout failed.");

      setClientSecret(data.clientSecret);
      setPublishableKey(data.publishableKey);
      setCurrency(data.currency ?? summary.currency);
      setStep("card");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePaySuccess(paymentIntentId: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/portal/payments/confirm-case-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Confirmation failed.");
      setStep("done");
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Make a Payment</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {step === "done" && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-lg font-semibold text-foreground">Payment received!</p>
              <p className="text-sm text-muted-foreground">Your payment has been recorded. Thank you.</p>
            </div>
          )}

          {step === "form" && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Payment amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                    {currency.toUpperCase()}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={maxAmountDollars}
                    step="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-14 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Outstanding balance: {formatCurrency(summary.outstandingCents, summary.currency)}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Next payment date <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  min={minDate}
                  max={maxDate}
                  value={nextPaymentDate}
                  onChange={(e) => setNextPaymentDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll send reminders as your next payment date approaches.
                </p>
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <button
                onClick={handleFormNext}
                disabled={loading || !amountInput}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue to Payment
              </button>
            </>
          )}

          {step === "card" && (
            <>
              <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
                <p className="text-xs text-muted-foreground mb-0.5">Paying</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(amountCents, currency)}</p>
              </div>

              <StripeCardForm
                publishableKey={publishableKey}
                clientSecret={clientSecret}
                buttonLabel={`Pay ${formatCurrency(amountCents, currency)}`}
                disabled={loading}
                onSuccess={handlePaySuccess}
              />

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <button
                onClick={() => { setStep("form"); setError(null); }}
                disabled={loading}
                className="w-full py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalPaymentsPage() {
  const session = usePortalSession();
  const orgName = session?.org.name ?? "your firm";
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payments, setPayments] = useState<PortalPayment[]>([]);
  const [contractSummary, setContractSummary] = useState<ContractSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    fetch("/api/portal/payments")
      .then((r) => r.json())
      .then((data) => {
        if (data.payments) setPayments(data.payments);
        if (data.contractSummary) setContractSummary(data.contractSummary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  usePolling(loadData, 15_000);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">Your contract fee overview and payment history.</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && contractSummary && !contractSummary.stripeEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 px-4 py-3.5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
            Online payment is currently unavailable. Please contact <strong>{orgName}</strong> directly to complete the payment process. Thank you for your understanding.
          </p>
        </div>
      )}

      {!loading && (
        <>
          {contractSummary && contractSummary.contractAmountCents > 0 && (
            <ContractSummaryCard summary={contractSummary} onPay={() => setShowPayDialog(true)} />
          )}

          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">Payment History</h2>
            {payments.length === 0 ? (
              <div className="rounded-xl border border-border bg-card shadow-sm p-12 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium text-foreground">No payments yet</p>
                <p className="text-sm text-muted-foreground mt-1 italic">Your payment history will appear here.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Method</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Reference</th>
                      <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                      <th className="text-right px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.map((p) => {
                      const isRefunded = p.status === "Refunded";
                      const isOnHold = p.status === "On Hold";
                      const isVoided = p.status === "Voided";
                      return (
                      <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 text-foreground">{formatDate(p.paidAt)}</td>
                        <td className="px-5 py-3.5">
                          {p.type === "case_fee" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                              <DollarSign className="h-3 w-3" />
                              Case Fee
                            </span>
                          ) : p.type === "appointment" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                              <Calendar className="h-3 w-3" />
                              Appointment
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{p.method}</td>
                        <td className="px-5 py-3.5 font-mono text-muted-foreground text-xs">{p.reference ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          {isOnHold ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
                              <Clock className="h-3 w-3" />
                              Pending Approval
                            </span>
                          ) : isVoided ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                              <Ban className="h-3 w-3" />
                              Voided
                            </span>
                          ) : isRefunded ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <RotateCcw className="h-3 w-3" />
                              Refunded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" />
                              Paid
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold">
                          <span className={
                            isVoided || isRefunded
                              ? "line-through text-muted-foreground"
                              : isOnHold
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }>
                            {formatCurrency(p.amount, p.currency)}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showPayDialog && contractSummary && (
        <PaymentDialog
          summary={contractSummary}
          onClose={() => setShowPayDialog(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
