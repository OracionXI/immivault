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

                    {/* ── Step 2: Agreement ── */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Administrator Agreement
                        </p>
                        <p className="text-sm text-foreground leading-relaxed">
                            By creating this organisation, I confirm that I am authorised to act as
                            its Administrator. I accept full responsibility for managing staff access,
                            client data, and compliance with applicable laws and Ordena&apos;s
                            Terms of Service.
                        </p>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                            />
                            <span className="text-sm text-foreground">
                                I agree to the Terms of Service and accept responsibility as Administrator
                                of this organisation.
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
