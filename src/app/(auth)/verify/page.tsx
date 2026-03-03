"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";

export default function VerifyPage() {
    const router = useRouter();
    const { signUp, setActive, isLoaded } = useSignUp();
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;
        setLoading(true);
        setError("");
        try {
            const result = await signUp.attemptEmailAddressVerification({ code });
            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.push("/dashboard");
            }
        } catch (err: unknown) {
            const clerkError = err as { errors?: { message: string }[] };
            setError(clerkError.errors?.[0]?.message ?? "Verification failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!isLoaded) return;
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    };

    return (
        <div className="w-full max-w-[360px]">
            <div className="mb-8 flex flex-col items-center">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "#181925" }}>
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" strokeLinejoin="round" />
                        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <h1 className="text-[1.375rem] font-semibold tracking-tight" style={{ color: "var(--auth-fg-4)" }}>
                    Check your email
                </h1>
                <p className="mt-1 text-center text-sm leading-relaxed" style={{ color: "var(--auth-fg-3)" }}>
                    We sent a 6-digit verification code to your email address.
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-3 rounded-lg px-3.5 py-2.5 text-sm" style={{ background: "oklch(0.97 0.02 20)", border: "1px solid oklch(0.85 0.1 20)", color: "oklch(0.45 0.2 20)" }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleVerify} className="space-y-3">
                <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-lg px-3.5 py-3 text-center text-2xl font-mono tracking-[0.5em] outline-none"
                    style={{ background: "var(--auth-bg-1)", border: "1px solid var(--auth-gray-2)", color: "var(--auth-fg-4)", boxShadow: "var(--auth-shadow-1)" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--auth-gray-2)")}
                />
                <button
                    type="submit"
                    disabled={loading || code.length < 6 || !isLoaded}
                    className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: "oklch(0.455 0.188 264.1)" }}
                >
                    {loading ? "Verifying…" : "Verify email"}
                </button>
            </form>

            <p className="mt-4 text-center text-sm" style={{ color: "var(--auth-fg-3)" }}>
                Didn&rsquo;t receive it?{" "}
                <button type="button" onClick={handleResend} disabled={!isLoaded} className="font-medium transition-colors hover:underline disabled:opacity-60" style={{ color: "var(--auth-fg-4)" }}>
                    Resend code
                </button>
            </p>
        </div>
    );
}
