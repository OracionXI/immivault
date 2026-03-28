"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FullScreenLoader } from "@/components/full-screen-loader";

// ─── Types ───────────────────────────────────────────────────────────────────

type SignatureMode = "type" | "draw";

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

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const router = useRouter();
    const currentUser = useQuery(api.users.queries.tryGetCurrentUser);
    const completeOnboarding = useMutation(api.organisations.mutations.completeOnboarding);

    const [orgName, setOrgName] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [sigMode, setSigMode] = useState<SignatureMode>("type");
    const [typedSig, setTypedSig] = useState("");
    const [drawnSig, setDrawnSig] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Prevents the status-guard from competing with the post-submit navigation.
    // Set to true the moment form submission succeeds so the guard won't fire
    // router.push("/dashboard") while we're already heading to /welcome.
    const completingRef = useRef(false);

    // Route guards based on user status
    useEffect(() => {
        if (currentUser === undefined || currentUser === null) return;
        if (completingRef.current) return; // form was just submitted — skip guard
        if (currentUser.status === "active") {
            router.push("/dashboard");
        } else if (currentUser.status === "inactive") {
            router.push("/waiting");
        }
        // status === "pending_onboarding" → show the form (no redirect needed)
    }, [currentUser, router]);

    const signature = sigMode === "type" ? typedSig.trim() : drawnSig ?? "";
    const isValid =
        orgName.trim().length >= 2 && agreed && signature.length > 0;

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
            // Mark as completing BEFORE pushing so the status-guard useEffect
            // won't race us with its own router.push("/dashboard").
            completingRef.current = true;
            router.push("/welcome");
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

    // Loading / syncing states
    if (currentUser === undefined) {
        return <FullScreenLoader message="Setting up your workspace…" />;
    }
    if (currentUser === null) {
        return <FullScreenLoader message="Syncing your account… This may take a moment." />;
    }
    if (currentUser.status !== "pending_onboarding") {
        return <FullScreenLoader message="Redirecting…" />;
    }

    return (
        <div className="flex min-h-screen items-start justify-center bg-background px-4 py-10">
            <div className="w-full max-w-[480px]">
                {/* Header */}
                <div className="mb-8 flex flex-col items-center text-center">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-6 w-6 text-primary-foreground"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                                strokeLinejoin="round"
                            />
                            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Set up your organisation
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                        Complete this one-time setup to create your workspace and accept administrator
                        responsibility.
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-5 rounded-lg px-3.5 py-2.5 text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ── Step 1: Organisation Name ── */}
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

                    {/* ── Step 2: Review & Agreement ── */}
                    <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Review & Agreement
                        </p>

                        {/* Terms of Service */}
                        <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                            <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-muted/30">
                                <span className="text-xs font-semibold text-foreground">Terms of Service</span>
                                <a
                                    href="/terms"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                >
                                    Open full document ↗
                                </a>
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

                        {/* Privacy Policy */}
                        <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                            <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-muted/30">
                                <span className="text-xs font-semibold text-foreground">Privacy Policy</span>
                                <a
                                    href="/privacy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                >
                                    Open full document ↗
                                </a>
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

                        {/* Agreement checkbox */}
                        <label className="flex items-start gap-3 cursor-pointer pt-1">
                            <input
                                type="checkbox"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
                            />
                            <span className="text-sm text-foreground">
                                I have read and agree to Ordena&apos;s{" "}
                                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                                    Terms of Service
                                </a>{" "}
                                and{" "}
                                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                                    Privacy Policy
                                </a>
                                , and I accept responsibility as Administrator of this organisation.
                            </span>
                        </label>
                    </div>

                    {/* ── Step 3: Signature ── */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-foreground">
                            Signature <span className="text-destructive">*</span>
                        </label>

                        {/* Mode toggle */}
                        <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
                            <button
                                type="button"
                                onClick={() => setSigMode("type")}
                                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                                    sigMode === "type"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Type
                            </button>
                            <button
                                type="button"
                                onClick={() => setSigMode("draw")}
                                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                                    sigMode === "draw"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Draw
                            </button>
                        </div>

                        {sigMode === "type" ? (
                            <SignatureTypeInput value={typedSig} onChange={setTypedSig} />
                        ) : (
                            <SignatureCanvas onSignatureChange={setDrawnSig} />
                        )}
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading || !isValid}
                        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Creating workspace…" : "Create workspace & continue"}
                    </button>
                </form>
            </div>
        </div>
    );
}
