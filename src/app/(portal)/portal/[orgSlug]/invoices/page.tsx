"use client";

import { useState, useEffect } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type PortalInvoice = {
  _id: string;
  invoiceNumber: string;
  total: number;
  status: string;
  dueDate: number;
  issuedAt: number | null;
  paidAt: number | null;
  paidAmount: number;
};

type PaymentLink = {
  _id: string;
  invoiceId: string | null;
  amount: number;
  description: string;
  urlToken: string;
  expiresAt: number;
};

const statusStyle: Record<string, string> = {
  Draft:   "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
  Sent:    "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  Paid:    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  Overdue: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents);
}

export default function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/invoices")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setInvoices(data.invoices ?? []);
          setPaymentLinks(data.paymentLinks ?? []);
        }
      })
      .catch(() => setError("Failed to load invoices."))
      .finally(() => setLoading(false));
  }, []);

  const getPayLink = (inv: PortalInvoice) =>
    paymentLinks.find((pl) => pl.invoiceId === inv._id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-1">View and pay your outstanding invoices.</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground">No invoices yet</p>
          <p className="text-sm text-muted-foreground mt-1 italic">Your invoices will appear here when issued.</p>
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const payLink = getPayLink(inv);
            const canPay = (inv.status === "Sent" || inv.status === "Overdue") && !!payLink;
            return (
              <div key={inv._id} className="rounded-xl border border-border bg-card shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground">{inv.invoiceNumber}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle[inv.status] ?? "bg-slate-500/15 text-slate-700 border-slate-500/20"}`}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      {inv.issuedAt && <span>Issued {formatDate(inv.issuedAt)}</span>}
                      <span>Due {formatDate(inv.dueDate)}</span>
                      {inv.paidAt && <span className="text-emerald-600 dark:text-emerald-400 font-medium">Paid {formatDate(inv.paidAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xl font-bold text-foreground">{formatAmount(inv.total)}</p>
                      {inv.paidAmount > 0 && inv.status !== "Paid" && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{formatAmount(inv.paidAmount)} paid</p>
                      )}
                    </div>
                    {canPay && (
                      <Button size="sm" asChild className="gap-1.5 shrink-0">
                        <a href={`/pay/${payLink.urlToken}`} target="_blank" rel="noopener noreferrer">
                          Pay Now
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
