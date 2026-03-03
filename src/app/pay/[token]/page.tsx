"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Clock, Loader2, Shield } from "lucide-react";

function formatAmount(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function PayPage({ params }: { params: { token: string } }) {
    const link = useQuery(api.billing.queries.getPaymentLinkByToken, { token: params.token });
    const processPayment = useMutation(api.billing.mutations.processPaymentLink);

    const [status, setStatus] = useState<"idle" | "paying" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // Still loading
    if (link === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Not found
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

    // Expired / inactive
    const isExpired = link.expiresAt < Date.now();
    const isInactive = link.status !== "Active";

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

    // Success state
    if (status === "success") {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center">
                    <CardContent className="pt-10 pb-8 space-y-3">
                        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                        <h2 className="text-lg font-semibold">Payment Successful</h2>
                        <p className="text-sm text-muted-foreground">
                            Thank you, {link.clientName}. Your payment of{" "}
                            <span className="font-medium">{formatAmount(link.amount)}</span> has been received.
                        </p>
                        {link.invoiceNumber && (
                            <p className="text-xs text-muted-foreground">Invoice {link.invoiceNumber} has been marked as paid.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handlePay = async () => {
        setStatus("paying");
        setErrorMsg("");
        try {
            await processPayment({ token: params.token });
            setStatus("success");
        } catch (err: unknown) {
            setStatus("error");
            const msg = err instanceof Error ? err.message : "Payment failed. Please try again.";
            setErrorMsg(msg);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center pb-2">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <Shield className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium text-muted-foreground">Secure Payment</span>
                    </div>
                    <CardTitle className="text-2xl">{formatAmount(link.amount)}</CardTitle>
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

                    {status === "error" && (
                        <p className="text-xs text-destructive text-center">{errorMsg}</p>
                    )}
                </CardContent>

                <CardFooter className="flex-col gap-3">
                    <Button
                        className="w-full gap-2"
                        size="lg"
                        onClick={handlePay}
                        disabled={status === "paying"}
                    >
                        {status === "paying" ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
                        ) : (
                            <>Pay {formatAmount(link.amount)}</>
                        )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                        Processed securely. You will receive a confirmation once payment is complete.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
