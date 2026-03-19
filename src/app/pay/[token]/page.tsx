"use client";

import { useState, useEffect, useRef, use } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { loadStripe, type Stripe, type StripeElements, type StripeCardElement } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Clock, Loader2, Shield, Lock } from "lucide-react";

function formatAmount(cents: number, currency = "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function PayPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const link = useQuery(api.billing.queries.getPaymentLinkByToken, { token });
    const createPaymentIntent = useAction(api.billing.actions.createPaymentIntent);
    const confirmPayment = useMutation(api.billing.mutations.confirmStripePayment);

    const [status, setStatus] = useState<"idle" | "loading_stripe" | "ready" | "paying" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [stripe, setStripe] = useState<Stripe | null>(null);
    const [elements, setElements] = useState<StripeElements | null>(null);
    const [clientSecret, setClientSecret] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [stripeAvailable, setStripeAvailable] = useState<boolean | null>(null);
    const cardElementRef = useRef<StripeCardElement | null>(null);
    const cardMountedRef = useRef(false);

    // Once the payment link loads, attempt to create a PaymentIntent
    useEffect(() => {
        if (!link || link.status !== "Active" || link.expiresAt < Date.now()) return;
        if (status !== "idle") return;

        setStatus("loading_stripe");

        createPaymentIntent({ token: token })
            .then(async (result) => {
                const stripeInstance = await loadStripe(result.publishableKey);
                if (!stripeInstance) {
                    setStripeAvailable(false);
                    setStatus("idle");
                    return;
                }
                setStripeAvailable(true);
                setClientSecret(result.clientSecret);
                setCurrency(result.currency);
                setStripe(stripeInstance);

                const els = stripeInstance.elements({ clientSecret: result.clientSecret });
                const card = els.create("card", {
                    style: {
                        base: {
                            fontSize: "14px",
                            color: "#ffffff",
                            "::placeholder": { color: "#94a3b8" },
                        },
                    },
                });
                cardElementRef.current = card;
                cardMountedRef.current = false;

                setElements(els);
                // Setting status to "ready" causes the #card-element div to render;
                // the mount effect below will then attach the card element to it.
                setStatus("ready");
            })
            .catch(() => {
                setStripeAvailable(false);
                setStatus("idle");
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [link]);

    // Mount the Stripe card element once the #card-element div is in the DOM
    useEffect(() => {
        if (status !== "ready" || !cardElementRef.current || cardMountedRef.current) return;
        const container = document.getElementById("card-element");
        if (container) {
            cardElementRef.current.mount(container);
            cardMountedRef.current = true;
        }
    }, [status]);

    // Still loading link from Convex
    if (link === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (link === null) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center">
                    <CardContent className="pt-10 pb-8 space-y-3">
                        <XCircle className="h-12 w-12 mx-auto text-destructive" />
                        <h2 className="text-lg font-semibold">Link Not Found</h2>
                        <p className="text-sm text-muted-foreground">
                            This payment link does not exist or has already been used.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isExpired = link.expiresAt < Date.now();
    const isInactive = link.status !== "Active";

    if (status === "success") {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center">
                    <CardContent className="pt-10 pb-8 space-y-3">
                        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                        <h2 className="text-lg font-semibold">Payment Successful</h2>
                        <p className="text-sm text-muted-foreground">
                            Thank you, {link.clientName}. Your payment of{" "}
                            <span className="font-medium">{formatAmount(link.amount, currency)}</span> has been received.
                        </p>
                        {link.invoiceNumber && (
                            <p className="text-xs text-muted-foreground">
                                Invoice {link.invoiceNumber} has been marked as paid.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isExpired || isInactive) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center">
                    <CardContent className="pt-10 pb-8 space-y-3">
                        <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
                        <h2 className="text-lg font-semibold">
                            {link.status === "Used" ? "Payment Already Completed" : "Link Expired"}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {link.status === "Used"
                                ? "This payment has already been processed. Thank you!"
                                : "This payment link has expired. Please contact your immigration attorney for a new link."}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ── Pay handler ───────────────────────────────────────────────────────────

    const handlePay = async () => {
        setStatus("paying");
        setErrorMsg("");

        try {
            // Stripe card payment
            if (stripe && clientSecret && cardElementRef.current) {
                const cardElement = cardElementRef.current;
                if (!cardElement) throw new Error("Card element not found.");

                const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: { card: cardElement },
                });

                if (error) {
                    setErrorMsg(error.message ?? "Payment failed. Please check your card details.");
                    setStatus("ready");
                    return;
                }

                if (paymentIntent?.status === "succeeded") {
                    await confirmPayment({ token: token, stripePaymentIntentId: paymentIntent.id });
                    setStatus("success");
                    return;
                }

                setErrorMsg("Payment was not completed. Please try again.");
                setStatus("ready");
                return;
            }

            // Legacy fallback (Stripe not configured for this org)
            const { processPaymentLink } = await import("../../../../convex/_generated/api").then(
                (m) => ({ processPaymentLink: m.api.billing.mutations.processPaymentLink })
            );
            const { useMutation: _useMutation } = await import("convex/react");
            void _useMutation; // not used here — use direct call
            throw new Error("Online card payments are not enabled for this organisation. Please contact your attorney.");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Payment failed. Please try again.";
            setErrorMsg(msg);
            setStatus("idle");
        }
    };

    const isLoading = status === "loading_stripe";
    const isPaying = status === "paying";

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center pb-2">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <Shield className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium text-muted-foreground">Secure Payment</span>
                    </div>
                    <CardTitle className="text-2xl">{formatAmount(link.amount, currency)}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                    <Separator />

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Client</span>
                            <span className="font-medium">{link.clientName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Description</span>
                            <span className="font-medium text-right max-w-[200px]">{link.description}</span>
                        </div>
                        {link.invoiceNumber && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Invoice</span>
                                <span className="font-medium">{link.invoiceNumber}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Expires</span>
                            <span className="font-medium">{formatDate(link.expiresAt)}</span>
                        </div>
                    </div>

                    <Separator />

                    {/* Stripe Card Element — only shown when Stripe is configured */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading secure payment form…
                        </div>
                    )}

                    {stripeAvailable && (status === "ready" || isPaying) && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <Lock className="h-3 w-3" />
                                Card details secured by Stripe
                            </div>
                            <div
                                id="card-element"
                                className="rounded-md border border-input bg-background px-3 py-3"
                            />
                        </div>
                    )}

                    {errorMsg && (
                        <p className="text-xs text-destructive text-center">{errorMsg}</p>
                    )}
                </CardContent>

                <CardFooter className="flex-col gap-3">
                    <Button
                        className="w-full gap-2"
                        size="lg"
                        onClick={handlePay}
                        disabled={isLoading || isPaying}
                    >
                        {isLoading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                        ) : isPaying ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
                        ) : (
                            <>Pay {formatAmount(link.amount, currency)}</>
                        )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                        {stripeAvailable
                            ? "Payments are processed securely by Stripe. We never store your card details."
                            : "Processed securely. You will receive a confirmation once payment is complete."}
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
