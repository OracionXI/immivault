"use client";

import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ExternalLink, Copy, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { HintPopover } from "@/components/shared/hint-popover";

export default function PaymentSettingsPage() {
    const settings = useQuery(api.organisations.queries.getSettings);
    const org = useQuery(api.organisations.queries.mine);
    const saveStripe = useAction(api.organisations.actions.saveStripeSettings);

    const [stripeEnabled, setStripeEnabled] = useState(false);
    const [publishableKey, setPublishableKey] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [webhookSecret, setWebhookSecret] = useState("");
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [webhookRevealed, setWebhookRevealed] = useState(false);

    // Populate from saved settings
    useEffect(() => {
        if (!settings) return;
        setStripeEnabled(settings.stripeEnabled ?? false);
        setPublishableKey(settings.stripePublishableKey ?? "");
        // Secret key is write-only — show placeholder if a value is saved (backend returns "REDACTED")
        if (settings.stripeSecretKey) setSecretKey("••••••••••••••••••••");
        if (settings.stripeWebhookSecret) setWebhookSecret("••••••••••••••••••••");
    }, [settings]);

    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    const webhookUrl = org && convexSiteUrl
        ? `${convexSiteUrl}/stripe-webhook?orgId=${org._id}`
        : "";

    const handleCopyWebhookUrl = () => {
        if (!webhookUrl) return;
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = async () => {
        // Don't overwrite saved keys if user left the masked placeholder
        // Pass empty string if key is masked (backend will skip updating encrypted field when empty)
        const sk = secretKey === "••••••••••••••••••••" ? "" : secretKey;
        const wh = webhookSecret === "••••••••••••••••••••" ? "" : webhookSecret;

        setSaving(true);
        try {
            await saveStripe({
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
                            <HintPopover
                                title="Stripe Integration"
                                description="Connect your Stripe account to accept online payments from clients directly through Ordena."
                                tips={[
                                    { text: "Use test keys (pk_test_ / sk_test_) during setup — switch to live keys when ready to go live." },
                                    { text: "Never share your Secret Key. It grants full access to your Stripe account." },
                                    { text: "After saving, register the Webhook URL in your Stripe Dashboard to receive payment events." },
                                ]}
                                links={[
                                    { label: "Get your API keys", href: "https://stripe.com/docs/keys" },
                                    { label: "Stripe Dashboard → API Keys", href: "https://dashboard.stripe.com/apikeys" },
                                ]}
                                accent="purple"
                                side="bottom"
                            />
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
                        <div className="flex items-center gap-1.5">
                            <Label>Publishable Key</Label>
                            <HintPopover
                                title="Publishable Key"
                                description="Safe to expose publicly — used in the browser to initialize Stripe.js for client-side payment flows."
                                tips={[
                                    { text: "Starts with pk_test_ (test mode) or pk_live_ (production)." },
                                    { text: "This key is not sensitive — it's embedded in your frontend code." },
                                ]}
                                links={[
                                    { label: "About API keys", href: "https://stripe.com/docs/keys" },
                                    { label: "Find your keys", href: "https://dashboard.stripe.com/apikeys" },
                                ]}
                                accent="blue"
                            />
                        </div>
                        <Input
                            value={publishableKey}
                            onChange={(e) => setPublishableKey(e.target.value)}
                            placeholder="pk_live_... or pk_test_..."
                        />
                    </div>
                    <div className="grid gap-2">
                        <div className="flex items-center gap-1.5">
                            <Label>Secret Key</Label>
                            <HintPopover
                                title="Secret Key"
                                description="Server-side only key used to create payment intents and charge customers. Never expose this in the browser."
                                tips={[
                                    { text: "Starts with sk_test_ (test mode) or sk_live_ (production)." },
                                    { text: "Store this securely — anyone with this key can make charges on your behalf." },
                                    { text: "If exposed, immediately roll it in the Stripe Dashboard." },
                                ]}
                                links={[
                                    { label: "About API keys", href: "https://stripe.com/docs/keys" },
                                    { label: "Roll a compromised key", href: "https://dashboard.stripe.com/apikeys" },
                                ]}
                                accent="rose"
                            />
                        </div>
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
                        <div className="flex items-center gap-1.5">
                            <Label>Webhook Secret</Label>
                            <HintPopover
                                title="Webhook Secret"
                                description="Used to verify that incoming webhook events genuinely come from Stripe and haven't been tampered with."
                                tips={[
                                    { text: "Starts with whsec_ — generated when you create a webhook endpoint in Stripe." },
                                    { text: "Ordena uses this to confirm payment events like payment_intent.succeeded." },
                                    { text: "Each webhook endpoint has its own secret — don't mix them up." },
                                ]}
                                links={[
                                    { label: "About Stripe Webhooks", href: "https://stripe.com/docs/webhooks" },
                                    { label: "Create a webhook endpoint", href: "https://dashboard.stripe.com/webhooks" },
                                ]}
                                accent="amber"
                            />
                        </div>
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
                            <div className="flex items-center gap-1.5">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Add this URL in your Stripe Dashboard → Webhooks:
                                </p>
                                <HintPopover
                                    title="Webhook URL"
                                    description="Register this endpoint in your Stripe Dashboard so Stripe can notify Ordena when payments succeed or fail."
                                    tips={[
                                        { text: "Go to Stripe Dashboard → Developers → Webhooks → Add endpoint." },
                                        { text: "Paste this URL and select payment_intent.succeeded as the event to listen for." },
                                        { text: "After creating the endpoint, copy the Signing Secret (whsec_...) and paste it in the Webhook Secret field above." },
                                    ]}
                                    links={[
                                        { label: "Add webhook endpoint", href: "https://dashboard.stripe.com/webhooks" },
                                        { label: "Stripe Webhooks guide", href: "https://stripe.com/docs/webhooks" },
                                    ]}
                                    accent="blue"
                                    side="top"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="text-xs flex-1 font-mono truncate select-none">
                                    {webhookRevealed
                                        ? webhookUrl
                                        : webhookUrl.slice(0, 8) + "•".repeat(Math.max(0, webhookUrl.length - 8))}
                                </code>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => setWebhookRevealed((v) => !v)}
                                    title={webhookRevealed ? "Hide URL" : "Reveal URL"}
                                >
                                    {webhookRevealed
                                        ? <EyeOff className="h-3.5 w-3.5" />
                                        : <Eye className="h-3.5 w-3.5" />
                                    }
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={handleCopyWebhookUrl}
                                    title="Copy to clipboard"
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

        </div>
    );
}
