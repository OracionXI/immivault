"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs/legacy";

export default function ResetPasswordPage() {
    const router = useRouter();
    const { signIn, setActive, isLoaded } = useSignIn();
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;
        setLoading(true);
        setError("");
        try {
            const result = await signIn.attemptFirstFactor({
                strategy: "reset_password_email_code",
                code,
                password,
            });
            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.push("/dashboard");
            }
        } catch (err: unknown) {
            const clerkError = err as { errors?: { message: string }[] };
            setError(clerkError.errors?.[0]?.message ?? "Password reset failed. Please try again.");
        } finally {
            setLoading(false);
        }
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
                    Set new password
                </h1>
                <p className="mt-1 text-center text-sm leading-relaxed" style={{ color: "var(--auth-fg-3)" }}>
                    Enter the code from your email and choose a new password.
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-3 rounded-lg px-3.5 py-2.5 text-sm" style={{ background: "oklch(0.97 0.02 20)", border: "1px solid oklch(0.85 0.1 20)", color: "oklch(0.45 0.2 20)" }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleReset} className="space-y-3">
                <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Reset code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
                    style={{ background: "var(--auth-bg-1)", border: "1px solid var(--auth-gray-2)", color: "var(--auth-fg-4)", boxShadow: "var(--auth-shadow-1)" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--auth-gray-2)")}
                />
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="New password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg px-3.5 py-2.5 pr-10 text-sm outline-none"
                        style={{ background: "var(--auth-bg-1)", border: "1px solid var(--auth-gray-2)", color: "var(--auth-fg-4)", boxShadow: "var(--auth-shadow-1)" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--auth-gray-2)")}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--auth-fg-2)" }} onClick={() => setShowPassword((v) => !v)}>
                        {showPassword ? "Hide" : "Show"}
                    </button>
                </div>
                <button
                    type="submit"
                    disabled={loading || !isLoaded}
                    className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: "oklch(0.455 0.188 264.1)" }}
                >
                    {loading ? "Resetting…" : "Reset password"}
                </button>
            </form>
        </div>
    );
}
