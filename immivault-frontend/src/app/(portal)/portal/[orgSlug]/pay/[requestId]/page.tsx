"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  CalendarDays, Clock, Loader2, Lock, CheckCircle2, AlertCircle,
  ShieldCheck, Video,
} from "lucide-react";
import { StripeCardForm } from "@/components/shared/stripe-card-form";

// ─── Types ────────────────────────────────────────────────────────────────────

type PayInitData = {
  clientSecret: string;
  publishableKey: string;
  amountCents: number;
  currency: string;
  appointmentType: string;
  preferredDate: string;
  preferredTime: string;
  orgName: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProspectPayPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const requestId = params.requestId as string;

  const [payData, setPayData] = useState<PayInitData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/portal/${orgSlug}/prospect-pay-init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    })
      .then((r) => r.json())
      .then((data: PayInitData & { error?: string }) => {
        if (data.error) { setLoadError(data.error); return; }
        setPayData(data);
      })
      .catch(() => setLoadError("Could not load payment page. Please try again."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/portal/${orgSlug}/prospect-pay-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, paymentIntentId }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!data.ok) {
        setConfirmError(data.error ?? "Payment received but confirmation failed. Please contact the office.");
        return;
      }
      setSuccess(true);
    } catch {
      setConfirmError("Payment received but confirmation failed. Please contact the office.");
    } finally {
      setConfirming(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-[3px] border-blue-600/30 border-t-blue-600 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading secure payment…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%)" }}>
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Payment unavailable</h1>
          <p className="text-sm text-slate-500 leading-relaxed">{loadError}</p>
          <p className="text-xs text-slate-400">If you believe this is an error, please contact the office directly.</p>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────

  if (success && payData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%)" }}>
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500" />
            <div className="px-8 py-10 text-center space-y-5">
              <div className="mx-auto h-20 w-20 rounded-3xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Payment received!</h1>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Your appointment with <span className="font-semibold text-slate-700">{payData.orgName}</span> has been confirmed.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 px-5 py-4 text-left space-y-2.5">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-800">{formatDate(payData.preferredDate)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-800">{formatTime(payData.preferredTime)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                A confirmation email has been sent to you. Please check your inbox.
              </p>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-5 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure payment processed by Stripe
          </p>
        </div>
      </div>
    );
  }

  // ── Payment form ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%)" }}>
      <div className="w-full max-w-md space-y-4">

        {/* Header */}
        <div className="text-center space-y-1 pb-2">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
            <Lock className="h-3.5 w-3.5" />
            Secure Payment
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Complete your booking</h1>
          <p className="text-sm text-slate-500">
            with <span className="font-semibold text-slate-700">{payData!.orgName}</span>
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {/* Appointment summary */}
          <div className="px-7 pt-7 pb-5 border-b border-slate-100 space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Appointment Details</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-sm text-slate-700 font-medium">{formatDate(payData!.preferredDate)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-sm text-slate-700 font-medium">{formatTime(payData!.preferredTime)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Video className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-600">{payData!.appointmentType} · 1 hour</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-sm text-slate-500">Total due</span>
              <span className="text-lg font-bold text-blue-600">
                {formatPrice(payData!.amountCents, payData!.currency)}
              </span>
            </div>
          </div>

          {/* Card form */}
          <div className="px-7 py-6 space-y-4">
            <label className="text-[13px] font-medium text-slate-700">Card details</label>

            <StripeCardForm
              publishableKey={payData!.publishableKey}
              clientSecret={payData!.clientSecret}
              buttonLabel={`Pay ${formatPrice(payData!.amountCents, payData!.currency)}`}
              colorMode="light"
              disabled={confirming}
              onSuccess={handlePaymentSuccess}
            />

            {/* Server-side confirmation error (shown after Stripe succeeds but server call fails) */}
            {confirmError && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {confirmError}
              </div>
            )}

            {confirming && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirming your booking…
              </div>
            )}

            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2.5">
              <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Your card will be charged immediately upon submission. The appointment is confirmed once payment is received.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Payments are processed securely by <strong className="text-slate-500">Stripe</strong>. Your card details are never stored.
        </p>

      </div>
    </div>
  );
}
