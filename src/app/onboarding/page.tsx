"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { FullScreenLoader } from "@/components/full-screen-loader";
import { Loader2, CheckCircle2, Unlink, CreditCard, Copy, Eye, EyeOff, ExternalLink, Globe, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HintPopover } from "@/components/shared/hint-popover";

// ─── Timezone helpers ─────────────────────────────────────────────────────────

const TIMEZONES = [
    "UTC",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Anchorage", "America/Honolulu", "America/Toronto", "America/Vancouver",
    "America/Mexico_City", "America/Sao_Paulo", "America/Argentina/Buenos_Aires",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome",
    "Europe/Amsterdam", "Europe/Stockholm", "Europe/Warsaw", "Europe/Istanbul",
    "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg",
    "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok",
    "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul",
    "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland",
];

function getUtcOffset(tz: string): string {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            timeZoneName: "shortOffset",
        }).formatToParts(new Date());
        return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
        return "";
    }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type SignatureMode = "type" | "draw";
type WizardStep = 0 | 1 | 2; // 0 = org setup, 1 = google calendar, 2 = stripe

// ─── Step indicator ──────────────────────────────────────────────────────────

function WizardStepIndicator({ current }: { current: 1 | 2 }) {
    const steps = [
        { n: 1, label: "Connect Calendar" },
        { n: 2, label: "Set up payments" },
    ];
    return (
        <div className="flex items-center gap-2 mb-8">
            {steps.map((s, i) => (
                <div key={s.n} className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                                current === s.n
                                    ? "bg-primary text-primary-foreground"
                                    : current > s.n
                                    ? "bg-primary/20 text-primary"
                                    : "bg-muted text-muted-foreground"
                            }`}
                        >
                            {current > s.n ? (
                                <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            ) : (
                                s.n
                            )}
                        </div>
                        <span className={`text-xs font-medium hidden sm:inline ${current === s.n ? "text-foreground" : "text-muted-foreground"}`}>
                            {s.label}
                        </span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`h-px w-8 transition-colors ${current > s.n ? "bg-primary/40" : "bg-border"}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Signature — Draw canvas ─────────────────────────────────────────────────

function SignatureCanvas({
    onSignatureChange,
}: {
    onSignatureChange: (dataUrl: string | null) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasDrawn = useRef(false);

    const getPos = (
        e: MouseEvent | TouchEvent,
        canvas: HTMLCanvasElement
    ): { x: number; y: number } => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ("touches" in e) {
            const touch = e.touches[0];
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY,
            };
        }
        return {
            x: ((e as MouseEvent).clientX - rect.left) * scaleX,
            y: ((e as MouseEvent).clientY - rect.top) * scaleY,
        };
    };

    const startDraw = useCallback(
        (e: MouseEvent | TouchEvent) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            e.preventDefault();
            drawing.current = true;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            const pos = getPos(e, canvas);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        },
        []
    );

    const draw = useCallback(
        (e: MouseEvent | TouchEvent) => {
            if (!drawing.current) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            e.preventDefault();
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            const pos = getPos(e, canvas);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = "#1e1e2e";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke();
            hasDrawn.current = true;
            onSignatureChange(canvas.toDataURL("image/png"));
        },
        [onSignatureChange]
    );

    const stopDraw = useCallback(() => {
        drawing.current = false;
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.addEventListener("mousedown", startDraw);
        canvas.addEventListener("mousemove", draw);
        canvas.addEventListener("mouseup", stopDraw);
        canvas.addEventListener("mouseleave", stopDraw);
        canvas.addEventListener("touchstart", startDraw, { passive: false });
        canvas.addEventListener("touchmove", draw, { passive: false });
        canvas.addEventListener("touchend", stopDraw);

        return () => {
            canvas.removeEventListener("mousedown", startDraw);
            canvas.removeEventListener("mousemove", draw);
            canvas.removeEventListener("mouseup", stopDraw);
            canvas.removeEventListener("mouseleave", stopDraw);
            canvas.removeEventListener("touchstart", startDraw);
            canvas.removeEventListener("touchmove", draw);
            canvas.removeEventListener("touchend", stopDraw);
        };
    }, [startDraw, draw, stopDraw]);

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn.current = false;
        onSignatureChange(null);
    };

    return (
        <div className="space-y-2">
            <div
                className="rounded-lg border border-border bg-white overflow-hidden"
                style={{ cursor: "crosshair" }}
            >
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={160}
                    className="w-full"
                    style={{ touchAction: "none" }}
                />
            </div>
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    Draw your signature above using mouse or touch
                </p>
                <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                >
                    Clear
                </button>
            </div>
        </div>
    );
}

// ─── Signature — Type input ──────────────────────────────────────────────────

function SignatureTypeInput({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-2">
            <input
                type="text"
                placeholder="Type your full legal name"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-3 text-xl outline-none transition-colors focus:border-primary"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}
            />
            <p className="text-xs text-muted-foreground">
                Typing your name constitutes a legally binding electronic signature
            </p>
        </div>
    );
}

// ─── Step 1 — Google Calendar ────────────────────────────────────────────────

function GoogleCalendarStep({
    googleEmail,
    onContinue,
}: {
    googleEmail: string | undefined;
    onContinue: () => void;
}) {
    const { getToken } = useAuth();
    const [connecting, setConnecting] = useState(false);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const token = await getToken({ template: "convex" });
            if (!token) throw new Error("Not authenticated");
            const popup = window.open(
                `/api/google-start?token=${encodeURIComponent(token)}`,
                "google-oauth",
                "width=500,height=650,left=100,top=100"
            );
            if (!popup) {
                toast.error("Popup blocked. Please allow popups for this site and try again.");
                setConnecting(false);
                return;
            }
            const onMessage = (e: MessageEvent) => {
                if (e.data === "google-connected") {
                    window.removeEventListener("message", onMessage);
                    toast.success("Google Calendar connected.");
                    setConnecting(false);
                }
            };
            window.addEventListener("message", onMessage);
            const pollClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(pollClosed);
                    window.removeEventListener("message", onMessage);
                    setConnecting(false);
                }
            }, 500);
        } catch {
            toast.error("Failed to initiate Google sign-in. Please try again.");
            setConnecting(false);
        }
    };

    return (
        <div className="space-y-6">
            <WizardStepIndicator current={1} />

            <div className="flex flex-col items-center text-center mb-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 border border-blue-100">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                </div>
                <h2 className="text-xl font-semibold tracking-tight">Connect Google Calendar</h2>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">
                    Required to auto-create Google Meet links and send calendar invites when you schedule appointments.
                </p>
            </div>

            {googleEmail ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-green-800">Connected</p>
                        <p className="text-xs text-green-700 mt-0.5">{googleEmail}</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1.5">
                        <p className="text-xs font-medium text-foreground">What this enables:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                            <li className="flex items-center gap-1.5"><span className="text-primary">→</span> Auto-generated Google Meet video links on every appointment</li>
                            <li className="flex items-center gap-1.5"><span className="text-primary">→</span> Calendar invites sent directly from your Google account</li>
                            <li className="flex items-center gap-1.5"><span className="text-primary">→</span> Appointments synced to your Google Calendar</li>
                        </ul>
                    </div>

                    <button
                        type="button"
                        onClick={handleConnect}
                        disabled={connecting}
                        className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {connecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <svg viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                        )}
                        {connecting ? "Opening Google sign-in…" : "Sign in with Google"}
                    </button>
                    <p className="text-center text-xs text-muted-foreground">
                        You can disconnect at any time from Settings → Profile
                    </p>
                </div>
            )}

            <button
                type="button"
                onClick={onContinue}
                disabled={!googleEmail}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                Continue
            </button>
        </div>
    );
}

// ─── Step 2 — Stripe setup ────────────────────────────────────────────────────

function StripeSetupStep({
    onComplete,
    orgId,
}: {
    onComplete: (skipped: boolean) => Promise<void>;
    orgId: string;
}) {
    const saveStripe = useAction(api.organisations.actions.saveStripeSettings);
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    const webhookUrl = orgId && convexSiteUrl ? `${convexSiteUrl}/stripe-webhook?orgId=${orgId}` : "";

    const [stripeEnabled, setStripeEnabled] = useState(false);
    const [publishableKey, setPublishableKey] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [webhookSecret, setWebhookSecret] = useState("");
    const [saving, setSaving] = useState(false);
    const [skipping, setSkipping] = useState(false);
    const [copied, setCopied] = useState(false);
    const [webhookRevealed, setWebhookRevealed] = useState(false);

    const isValid = publishableKey.trim().length > 0 && secretKey.trim().length > 0 && webhookSecret.trim().length > 0;

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveStripe({
                stripeEnabled,
                stripePublishableKey: publishableKey,
                stripeSecretKey: secretKey,
                stripeWebhookSecret: webhookSecret,
            });
            await onComplete(false);
        } catch {
            toast.error("Failed to save Stripe settings. Please check your keys and try again.");
            setSaving(false);
        }
    };

    const handleSkip = async () => {
        setSkipping(true);
        await onComplete(true);
    };

    const handleCopyWebhook = () => {
        if (!webhookUrl) return;
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6">
            <WizardStepIndicator current={2} />

            <div className="flex flex-col items-center text-center mb-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 border border-violet-100">
                    <CreditCard className="h-6 w-6 text-violet-500" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">Set up online payments</h2>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">
                    Connect Stripe to accept card payments from clients directly through Ordena. You can do this later.
                </p>
            </div>

            <div className="space-y-4">
                {/* Enable toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <div>
                        <p className="text-sm font-medium">Enable Stripe payments</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Allow clients to pay invoices online</p>
                    </div>
                    <Switch checked={stripeEnabled} onCheckedChange={setStripeEnabled} />
                </div>

                {/* Publishable key */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <Label className="text-sm">Publishable Key</Label>
                        <HintPopover
                            title="Publishable Key"
                            description="Safe to expose publicly — used in the browser to initialise Stripe.js."
                            tips={[{ text: "Starts with pk_test_ (test) or pk_live_ (production)." }]}
                            links={[{ label: "Stripe API keys", href: "https://dashboard.stripe.com/apikeys" }]}
                            accent="blue"
                        />
                    </div>
                    <Input
                        value={publishableKey}
                        onChange={(e) => setPublishableKey(e.target.value)}
                        placeholder="pk_live_… or pk_test_…"
                    />
                </div>

                {/* Secret key */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <Label className="text-sm">Secret Key</Label>
                        <HintPopover
                            title="Secret Key"
                            description="Server-side only. Never share this key — it grants full access to your Stripe account."
                            tips={[{ text: "Starts with sk_test_ (test) or sk_live_ (production)." }]}
                            links={[{ label: "Stripe API keys", href: "https://dashboard.stripe.com/apikeys" }]}
                            accent="rose"
                        />
                    </div>
                    <Input
                        type="password"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        placeholder="sk_live_… or sk_test_…"
                    />
                </div>

                {/* Webhook secret */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <Label className="text-sm">Webhook Secret</Label>
                        <HintPopover
                            title="Webhook Secret"
                            description="Verifies that incoming events genuinely come from Stripe."
                            tips={[
                                { text: "Starts with whsec_ — generated when you create a webhook endpoint in Stripe." },
                                { text: "Go to Stripe Dashboard → Developers → Webhooks → Add endpoint, paste the URL below." },
                            ]}
                            links={[{ label: "Stripe Webhooks", href: "https://dashboard.stripe.com/webhooks" }]}
                            accent="amber"
                        />
                    </div>
                    <Input
                        type="password"
                        value={webhookSecret}
                        onChange={(e) => setWebhookSecret(e.target.value)}
                        placeholder="whsec_…"
                    />
                </div>

                {/* Webhook URL helper */}
                {webhookUrl && (
                    <div className="rounded-md bg-muted p-3 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Register this URL in Stripe Dashboard → Webhooks:</p>
                        <div className="flex items-center gap-2">
                            <code className="text-xs flex-1 font-mono truncate select-none">
                                {webhookRevealed ? webhookUrl : webhookUrl.slice(0, 8) + "•".repeat(Math.max(0, webhookUrl.length - 8))}
                            </code>
                            <button type="button" onClick={() => setWebhookRevealed(v => !v)} className="p-1 hover:text-foreground text-muted-foreground transition-colors">
                                {webhookRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" onClick={handleCopyWebhook} className="p-1 hover:text-foreground text-muted-foreground transition-colors">
                                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noreferrer" className="p-1 hover:text-foreground text-muted-foreground transition-colors">
                                <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Listen for: <code className="bg-background px-1 rounded">payment_intent.succeeded</code>
                        </p>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || skipping || !isValid}
                    className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? "Saving…" : "Save & continue"}
                </button>
                <button
                    type="button"
                    onClick={handleSkip}
                    disabled={saving || skipping}
                    className="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {skipping && <Loader2 className="h-4 w-4 animate-spin" />}
                    Skip for now
                </button>
                <p className="text-center text-xs text-muted-foreground">
                    You can always configure Stripe later from Payments → Settings
                </p>
            </div>
        </div>
    );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const router = useRouter();
    const currentUser = useQuery(api.users.queries.tryGetCurrentUser);
    // Only query org settings once the user is active (authenticatedQuery rejects pending_onboarding)
    const settings = useQuery(
        api.organisations.queries.getSettings,
        currentUser?.status === "active" ? {} : "skip"
    );
    const org = useQuery(
        api.organisations.queries.mine,
        currentUser?.status === "active" ? {} : "skip"
    );
    const completeOnboarding = useMutation(api.organisations.mutations.completeOnboarding);
    const markWizardComplete = useMutation(api.users.mutations.markWizardComplete);
    const seedDefaultAvailability = useMutation(api.users.mutations.seedDefaultAvailability);

    const [wizardStep, setWizardStep] = useState<WizardStep | null>(null);
    const markingCompleteRef = useRef(false);

    // Step 0 form state
    const [orgName, setOrgName] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [sigMode, setSigMode] = useState<SignatureMode>("type");
    const [typedSig, setTypedSig] = useState("");
    const [drawnSig, setDrawnSig] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Timezone: detect from browser; user can correct before it's saved.
    // This is the only chance to set it correctly — borrowed devices / VPNs
    // can report a wrong timezone which would silently misalign all availability slots.
    const detectedTz = typeof window !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";
    const [selectedTz, setSelectedTz] = useState<string>(detectedTz);
    // Flag mismatch only when the list contains the detected tz but it's not in TIMEZONES
    // (meaning we auto-detected something exotic — worth surfacing)
    const detectedTzInList = TIMEZONES.includes(detectedTz);
    const tzMismatch = detectedTzInList && selectedTz !== detectedTz;

    // ── Routing / resume logic ──────────────────────────────────────────────
    useEffect(() => {
        if (currentUser === undefined || currentUser === null) return;

        if (currentUser.status === "inactive") {
            router.push("/waiting");
            return;
        }

        if (currentUser.status === "pending_onboarding") {
            if (wizardStep === null) setWizardStep(0);
            return;
        }

        if (currentUser.status === "active") {
            // Non-founders or founders who completed the wizard go to dashboard
            if (!currentUser.isFounder || currentUser.wizardCompletedAt) {
                router.push("/dashboard");
                return;
            }

            // Founder with incomplete wizard — only handle resume (wizardStep null or 0)
            if (wizardStep !== null && wizardStep >= 1) return;

            if (!currentUser.googleEmail) {
                // Google not connected yet → step 1
                setWizardStep(1);
                return;
            }

            // Google connected — need settings to decide on stripe step
            if (settings === undefined) return; // wait for settings

            if (markingCompleteRef.current) return;

            const stripeConfigured = !!(settings?.stripePublishableKey || settings?.stripeWizardSkipped);
            if (stripeConfigured) {
                // Everything already done — auto-complete and redirect
                markingCompleteRef.current = true;
                markWizardComplete({}).then(() => router.push("/welcome")).catch(() => {
                    markingCompleteRef.current = false;
                });
            } else {
                setWizardStep(2);
            }
        }
    }, [currentUser, settings, wizardStep, router, markWizardComplete]);

    // ── Step 0 submit ───────────────────────────────────────────────────────
    const signature = sigMode === "type" ? typedSig.trim() : drawnSig ?? "";
    const isValid = orgName.trim().length >= 2 && agreed && signature.length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        setLoading(true);
        setError("");
        try {
            await completeOnboarding({
                orgName: orgName.trim(),
                agreementSignature: signature,
            });
            // Seed the user-confirmed timezone + default Mon–Fri 9–17 availability.
            // Using selectedTz (not re-detecting) so the choice made in the wizard is honoured.
            await seedDefaultAvailability({ timezone: selectedTz }).catch(() => {});
            // Advance to Google step
            setWizardStep(1);
        } catch (err: unknown) {
            const convexErr = err as { data?: { message?: string }; message?: string };
            setError(
                convexErr?.data?.message ??
                convexErr?.message ??
                "Something went wrong. Please try again."
            );
            setLoading(false);
        }
    };

    // ── Wizard completion ───────────────────────────────────────────────────
    const handleWizardComplete = async (stripeSkipped: boolean) => {
        await markWizardComplete({ stripeSkipped });
        router.push("/welcome");
    };

    // ── Loading states ──────────────────────────────────────────────────────
    if (currentUser === undefined) {
        return <FullScreenLoader message="Setting up your workspace…" />;
    }
    if (currentUser === null) {
        return <FullScreenLoader message="Syncing your account… This may take a moment." />;
    }
    if (wizardStep === null) {
        return <FullScreenLoader message="Preparing your workspace…" />;
    }
    if (currentUser.status !== "pending_onboarding" && !(currentUser.isFounder && !currentUser.wizardCompletedAt)) {
        return <FullScreenLoader message="Redirecting…" />;
    }

    return (
        <div className="flex min-h-screen items-start justify-center bg-background px-4 py-10">
            <div className="w-full max-w-[480px]">

                {/* ── Step 0: Org setup ─────────────────────────────────────────────── */}
                {wizardStep === 0 && (
                    <>
                        <div className="mb-8 flex flex-col items-center text-center">
                            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-primary-foreground" stroke="currentColor" strokeWidth={2}>
                                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" strokeLinejoin="round" />
                                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight">Set up your organisation</h1>
                            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                                Complete this one-time setup to create your workspace and accept administrator responsibility.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-5 rounded-lg px-3.5 py-2.5 text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">
                                    Organisation name <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    minLength={2}
                                    placeholder="e.g. Smith & Associates Law Firm"
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                                />
                                <p className="text-xs text-muted-foreground">
                                    This will be the name of your Ordena workspace.
                                </p>
                            </div>

                            {/* ── Timezone confirmation ─────────────────────────────────── */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5">
                                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                    <label className="text-sm font-medium text-foreground">
                                        Your timezone
                                    </label>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Your availability hours are stored and interpreted in this timezone.
                                    Prospects always see slots converted to their own local time automatically.
                                    <span className="font-medium text-foreground"> Correct this now</span> — if you&apos;re on a VPN or a borrowed device, the detected timezone may be wrong.
                                </p>
                                <Select value={selectedTz} onValueChange={setSelectedTz}>
                                    <SelectTrigger className="w-full text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMEZONES.map((tz) => (
                                            <SelectItem key={tz} value={tz}>
                                                {tz.replace(/_/g, " ")} ({getUtcOffset(tz)})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {/* Mismatch warning: shown when the user changed the selection away from
                                    what the browser reported — confirms they made a deliberate choice */}
                                {tzMismatch && (
                                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            Your browser reports <span className="font-semibold">{detectedTz}</span> but you selected{" "}
                                            <span className="font-semibold">{selectedTz}</span>. Make sure this is intentional — all your availability windows will be interpreted in the selected timezone.
                                        </span>
                                    </div>
                                )}
                                {!detectedTzInList && (
                                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                                        <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            Your detected timezone (<span className="font-semibold">{detectedTz}</span>) isn&apos;t in the list above. Please select the closest match manually.
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Review & Agreement</p>

                                <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                                    <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-muted/30">
                                        <span className="text-xs font-semibold text-foreground">Terms of Service</span>
                                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Open full document ↗</a>
                                    </div>
                                    <div className="h-44 overflow-y-auto px-3.5 py-3 text-xs text-muted-foreground leading-relaxed space-y-2">
                                        <p><span className="font-semibold text-foreground">1. Acceptance.</span> By using Ordena, you agree to be bound by these Terms of Service.</p>
                                        <p><span className="font-semibold text-foreground">2. Service.</span> Ordena is a cloud-based case management platform for law firms, including client management, case tracking, task management, document storage, appointment scheduling, billing, and a Client Portal.</p>
                                        <p><span className="font-semibold text-foreground">3. Eligibility.</span> You must be at least 18 years old and authorised to act on behalf of your organisation.</p>
                                        <p><span className="font-semibold text-foreground">4. Account Responsibilities.</span> You are responsible for all activity under your account. Organisation administrators are responsible for managing staff access.</p>
                                        <p><span className="font-semibold text-foreground">5. Acceptable Use.</span> You agree not to use the Service for unlawful purposes, upload malicious code, attempt unauthorised access, reverse engineer the Service, or resell access without consent.</p>
                                        <p><span className="font-semibold text-foreground">6. Client Portal.</span> Portal access is invitation-only and org-scoped. Administrators are responsible for ensuring portal access is granted only to legitimate clients.</p>
                                        <p><span className="font-semibold text-foreground">7. Google Calendar.</span> Optional integration with Google Calendar is governed by the Google API Services User Data Policy. You may revoke access at any time.</p>
                                        <p><span className="font-semibold text-foreground">8. Data Ownership.</span> You retain ownership of all data you input. We process it solely to provide the Service.</p>
                                        <p><span className="font-semibold text-foreground">9. Billing.</span> Subscription fees are non-refundable except as required by law. Ordena does not hold client funds directly.</p>
                                        <p><span className="font-semibold text-foreground">10. Organisation Deletion.</span> A 30-day grace period applies before all organisation data is permanently deleted.</p>
                                        <p><span className="font-semibold text-foreground">11. Intellectual Property.</span> The Service and its design are owned by Ordena. You may not copy or reproduce any part without written permission.</p>
                                        <p><span className="font-semibold text-foreground">12. Disclaimer.</span> The Service is provided &quot;as is&quot; without warranties of any kind.</p>
                                        <p><span className="font-semibold text-foreground">13. Limitation of Liability.</span> Ordena is not liable for indirect, incidental, or consequential damages.</p>
                                        <p><span className="font-semibold text-foreground">14. Termination.</span> We may suspend or terminate access if these Terms are violated. You may terminate via Settings at any time.</p>
                                        <p><span className="font-semibold text-foreground">15. Changes.</span> Material changes will be communicated via email. Continued use constitutes acceptance.</p>
                                        <p><span className="font-semibold text-foreground">16. Governing Law.</span> Disputes are resolved through binding arbitration or courts of competent jurisdiction.</p>
                                        <p><span className="font-semibold text-foreground">17. Contact.</span> Questions? Email aws200workspace@gmail.com</p>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                                    <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-muted/30">
                                        <span className="text-xs font-semibold text-foreground">Privacy Policy</span>
                                        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Open full document ↗</a>
                                    </div>
                                    <div className="h-44 overflow-y-auto px-3.5 py-3 text-xs text-muted-foreground leading-relaxed space-y-2">
                                        <p><span className="font-semibold text-foreground">1. Introduction.</span> Ordena collects and uses information to provide the Service at ordenacrm.com. By using Ordena, you agree to this policy.</p>
                                        <p><span className="font-semibold text-foreground">2. Information We Collect.</span> We collect account information (name, email, organisation), Google Calendar data when authorised, client and case data you enter, client portal data (profile, hashed session tokens, OTP codes), payment information (handled by Stripe — we do not store card numbers), and anonymised usage data.</p>
                                        <p><span className="font-semibold text-foreground">3. How We Use It.</span> To operate the platform, sync calendar events, send transactional emails, authenticate users, process client payments, and send profile completion reminders to portal clients.</p>
                                        <p><span className="font-semibold text-foreground">4. Google API Services.</span> We adhere to the Google API Services User Data Policy, including Limited Use requirements. Google Calendar data is used solely to manage appointments and is never shared with third parties or used for advertising.</p>
                                        <p><span className="font-semibold text-foreground">5. Data Sharing.</span> We do not sell your data. We share it only with: Convex (infrastructure), Clerk (authentication), Vercel (hosting), Resend (email), Stripe (payments), and Google (calendar — when authorised).</p>
                                        <p><span className="font-semibold text-foreground">6. Data Retention.</span> Data is retained while your account is active. Upon deletion, all data is permanently removed after a 30-day grace period. Portal tokens expire automatically.</p>
                                        <p><span className="font-semibold text-foreground">7. Security.</span> We use TLS, AES-256-GCM encryption, SHA-256 hashing for tokens, httpOnly secure cookies for portal sessions, role-based access control, and rate limiting.</p>
                                        <p><span className="font-semibold text-foreground">8. Your Rights.</span> You have the right to access, correct, or delete your data, revoke Google Calendar access, export data, and delete portal profile data.</p>
                                        <p><span className="font-semibold text-foreground">9. Children.</span> Ordena is not directed at children under 16.</p>
                                        <p><span className="font-semibold text-foreground">10. Changes.</span> We will notify users of material changes via email.</p>
                                        <p><span className="font-semibold text-foreground">11. Contact.</span> Questions? Email aws200workspace@gmail.com</p>
                                    </div>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer pt-1">
                                    <input
                                        type="checkbox"
                                        checked={agreed}
                                        onChange={(e) => setAgreed(e.target.checked)}
                                        className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
                                    />
                                    <span className="text-sm text-foreground">
                                        I have read and agree to Ordena&apos;s{" "}
                                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Terms of Service</a>{" "}
                                        and{" "}
                                        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Privacy Policy</a>
                                        , and I accept responsibility as Administrator of this organisation.
                                    </span>
                                </label>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-foreground">
                                    Signature <span className="text-destructive">*</span>
                                </label>
                                <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
                                    <button type="button" onClick={() => setSigMode("type")} className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${sigMode === "type" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Type</button>
                                    <button type="button" onClick={() => setSigMode("draw")} className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${sigMode === "draw" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Draw</button>
                                </div>
                                {sigMode === "type" ? (
                                    <SignatureTypeInput value={typedSig} onChange={setTypedSig} />
                                ) : (
                                    <SignatureCanvas onSignatureChange={setDrawnSig} />
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !isValid}
                                className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loading ? "Creating workspace…" : "Create workspace & continue"}
                            </button>
                        </form>
                    </>
                )}

                {/* ── Step 1: Google Calendar ───────────────────────────────────────── */}
                {wizardStep === 1 && (
                    <GoogleCalendarStep
                        googleEmail={currentUser.googleEmail}
                        onContinue={() => setWizardStep(2)}
                    />
                )}

                {/* ── Step 2: Stripe setup ──────────────────────────────────────────── */}
                {wizardStep === 2 && (
                    <StripeSetupStep
                        onComplete={handleWizardComplete}
                        orgId={org?._id ?? ""}
                    />
                )}

            </div>
        </div>
    );
}
