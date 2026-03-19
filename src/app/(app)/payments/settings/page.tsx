"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Building2, ExternalLink, Copy, CheckCircle2 } from "lucide-react";

export default function PaymentSettingsPage() {
    const settings = useQuery(api.organisations.queries.getSettings);
    const org = useQuery(api.organisations.queries.mine);
    const updateStripe = useMutation(api.organisations.mutations.updateStripeSettings);

    const [stripeEnabled, setStripeEnabled] = useState(false);
    const [publishableKey, setPublishableKey] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [webhookSecret, setWebhookSecret] = useState("");
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // Populate from saved settings
    useEffect(() => {
        if (!settings) return;
        setStripeEnabled(settings.stripeEnabled ?? false);
        setPublishableKey(settings.stripePublishableKey ?? "");
        // Secret key is write-only — show placeholder if saved
        if (settings.stripeSecretKey) setSecretKey("••••••••••••••••••••");
        if (settings.stripeWebhookSecret) setWebhookSecret("••••••••••••••••••••");
    }, [settings]);

    const webhookUrl = org
        ? `https://tremendous-poodle-485.convex.site/stripe-webhook?orgId=${org._id}`
        : "";

    const handleCopyWebhookUrl = () => {
        if (!webhookUrl) return;
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = async () => {
        // Don't overwrite saved keys if user left the masked placeholder
        const sk = secretKey === "••••••••••••••••••••" ? (settings?.stripeSecretKey ?? "") : secretKey;
        const wh = webhookSecret === "••••••••••••••••••••" ? (settings?.stripeWebhookSecret ?? "") : webhookSecret;

        setSaving(true);
        try {
            await updateStripe({
                stripeEnabled,
                stripePublishableKey: publishableKey,
                stripeSecretKey: sk,
                stripeWebhookSecret: wh,
            });
            toast.success("Stripe settings saved.");
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (settings === undefined) {
        return (
            <div className="space-y-6">
                <PageHeader title="Payment Settings" description="Configure payment gateways and preferences" />
                <Card>
                    <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-9 w-28" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader title="Payment Settings" description="Configure payment gateways and preferences" />

            {/* Stripe */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-violet-500" />
                            <CardTitle className="text-base">Stripe</CardTitle>
                            {settings?.stripeEnabled && (
                                <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />Active
                                </Badge>
                            )}
                        </div>
                        <Switch
                            checked={stripeEnabled}
                            onCheckedChange={setStripeEnabled}
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Publishable Key</Label>
                        <Input
                            value={publishableKey}
                            onChange={(e) => setPublishableKey(e.target.value)}
                            placeholder="pk_live_... or pk_test_..."
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Secret Key</Label>
                        <Input
                            type="password"
                            value={secretKey}
                            onChange={(e) => setSecretKey(e.target.value)}
                            placeholder="sk_live_... or sk_test_..."
                            onFocus={() => {
                                if (secretKey === "••••••••••••••••••••") setSecretKey("");
                            }}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Webhook Secret</Label>
                        <Input
                            type="password"
                            value={webhookSecret}
                            onChange={(e) => setWebhookSecret(e.target.value)}
                            placeholder="whsec_..."
                            onFocus={() => {
                                if (webhookSecret === "••••••••••••••••••••") setWebhookSecret("");
                            }}
                        />
                    </div>

                    {/* Webhook URL */}
                    {webhookUrl && (
                        <div className="rounded-md bg-muted p-3 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                                Add this URL in your Stripe Dashboard → Webhooks:
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="text-xs flex-1 break-all">{webhookUrl}</code>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={handleCopyWebhookUrl}
                                >
                                    {copied
                                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                        : <Copy className="h-3.5 w-3.5" />
                                    }
                                </Button>
                                <a
                                    href="https://dashboard.stripe.com/webhooks"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                </a>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Listen for: <code className="bg-background px-1 rounded">payment_intent.succeeded</code>
                            </p>
                        </div>
                    )}

                    <Button size="sm" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving…" : "Save Stripe Settings"}
                    </Button>
                </CardContent>
            </Card>

            <Separator />

            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-5 w-5" /> Linked Bank Accounts
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground italic">
                        Bank accounts are managed in{" "}
                        <span className="font-medium">Settings → Bank Accounts</span>.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
