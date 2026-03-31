"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";
import { Lock, Loader2, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StripeCardFormProps {
  publishableKey: string;
  clientSecret: string;
  /** Label shown on the pay button, e.g. "Pay $99.00" */
  buttonLabel: string;
  /** Disable the button from outside (e.g. while waiting for server confirmation) */
  disabled?: boolean;
  /**
   * "auto" (default) — detects dark/light mode and picks text color accordingly.
   * "light"           — always renders with dark text (use on light-only pages).
   */
  colorMode?: "auto" | "light";
  /** Called with the Stripe PaymentIntent ID after confirmCardPayment succeeds. */
  onSuccess: (paymentIntentId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StripeCardForm({
  publishableKey,
  clientSecret,
  buttonLabel,
  disabled = false,
  colorMode = "auto",
  onSuccess,
}: StripeCardFormProps) {
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const mountDivRef = useRef<HTMLDivElement | null>(null);
  // Keep clientSecret up-to-date in a ref so handlePay never goes stale
  const clientSecretRef = useRef(clientSecret);
  useEffect(() => { clientSecretRef.current = clientSecret; }, [clientSecret]);

  // Load Stripe and create the card element. Includes proper Strict Mode cleanup.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stripe = await loadStripe(publishableKey);
      if (cancelled || !stripe) return;

      const isDark =
        colorMode === "light"
          ? false
          : typeof document !== "undefined" &&
            document.documentElement.classList.contains("dark");

      const elements = stripe.elements();
      const card = elements.create("card", {
        style: {
          base: {
            fontSize: "15px",
            color: isDark ? "#f9fafb" : "#111827",
            fontFamily: "inherit",
            "::placeholder": { color: isDark ? "#6b7280" : "#9ca3af" },
          },
          invalid: { color: isDark ? "#f87171" : "#ef4444" },
        },
      });

      stripeRef.current = stripe;
      cardRef.current = card;

      // Mount immediately if the div is already in the DOM
      const mountNode = mountDivRef.current;
      if (mountNode && !mountNode.hasChildNodes()) {
        card.on("ready", () => { if (!cancelled) setReady(true); });
        card.mount(mountNode);
      }
    })();

    return () => {
      cancelled = true;
      // Destroy so a Strict Mode re-run or remount starts clean
      if (cardRef.current) {
        try { cardRef.current.destroy(); } catch { /* ignore */ }
        cardRef.current = null;
      }
      stripeRef.current = null;
      setReady(false);
    };
  // publishableKey and colorMode are mount-time constants — intentional dep list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishableKey, colorMode]);

  // Stable callback ref — mounts the card when the div first enters the DOM
  const setMountNode = useCallback((node: HTMLDivElement | null) => {
    mountDivRef.current = node;
    if (node && cardRef.current && !node.hasChildNodes()) {
      cardRef.current.on("ready", () => setReady(true));
      cardRef.current.mount(node);
    }
  }, []);

  const handlePay = async () => {
    const stripe = stripeRef.current;
    const card = cardRef.current;
    if (!stripe || !card) return;

    setPaying(true);
    setError(null);

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecretRef.current,
        { payment_method: { card } },
      );

      if (stripeError) {
        setError(stripeError.message ?? "Card declined. Please try another card.");
        return;
      }
      if (!paymentIntent || !["succeeded", "requires_capture"].includes(paymentIntent.status)) {
        setError("Payment was not completed. Please try again.");
        return;
      }

      onSuccess(paymentIntent.id);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Loading indicator — shown until Stripe signals ready */}
      {!ready && (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading payment form…
        </div>
      )}

      {/* Stripe card element mount point */}
      <div
        ref={setMountNode}
        className="w-full px-4 py-3 rounded-lg border border-input bg-background min-h-[44px] transition-colors focus-within:border-primary/60"
      />

      {/* Stripe error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={paying || !ready || disabled}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {paying
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
          : <><Lock className="h-4 w-4" /> {buttonLabel}</>
        }
      </button>
    </div>
  );
}
