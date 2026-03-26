"use client";

import { useState, useEffect } from "react";
import { CreditCard } from "lucide-react";

type PortalPayment = {
  _id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  paidAt: number;
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(cents);
}

export default function PortalPaymentsPage() {
  const [payments, setPayments] = useState<PortalPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/payments")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setPayments(data.payments ?? []);
      })
      .catch(() => setError("Failed to load payments."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Payment History</h1>
        <p className="text-sm text-muted-foreground mt-1">Your completed payments.</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && payments.length === 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-16 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground">No payments yet</p>
          <p className="text-sm text-muted-foreground mt-1 italic">Your payment history will appear here.</p>
        </div>
      )}

      {!loading && payments.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Method</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Reference</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => (
                <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 text-foreground">{formatDate(p.paidAt)}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{p.method}</td>
                  <td className="px-5 py-3.5 font-mono text-muted-foreground text-xs">{p.reference ?? "—"}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatAmount(p.amount, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
