"use client";

import { useSignIn } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "reset";

function EyeIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function EyeOffIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}

function Spinner() {
    return (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

function ErrorBox({ message }: { message: string }) {
    return (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {message}
        </div>
    );
}

export default function ForgotPasswordPage() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const router = useRouter();

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleEmailSubmit() {
        if (!isLoaded) return;
        setError(""); setLoading(true);
        try {
            await signIn.create({ strategy: "reset_password_email_code", identifier: email });
            setStep("reset");
        } catch (err: unknown) {
            const e = err as { errors?: { message: string }[] };
            setError(e.errors?.[0]?.message ?? "Could not send reset email. Please try again.");
        } finally { setLoading(false); }
    }

    async function handleResetSubmit() {
        if (!isLoaded) return;
        setError(""); setLoading(true);
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
            const e = err as { errors?: { message: string }[] };
            setError(e.errors?.[0]?.message ?? "Password reset failed. Please try again.");
        } finally { setLoading(false); }
    }

    return (
        <>
            {step === "email" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); void handleEmailSubmit(); }}
                    className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 space-y-6"
                >
                    <div className="space-y-1.5 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                            <svg className="h-6 w-6 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                        </div>
                        <h1 className="text-[1.75rem] font-bold tracking-tight text-gray-900">Forgot your password?</h1>
                        <p className="text-sm text-gray-500">Enter your email and we&apos;ll send you a reset code.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email address</Label>
                            <Input
                                id="email" type="email" autoComplete="email" required autoFocus
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com" className="h-11 text-gray-900 placeholder:text-gray-400"
                            />
                        </div>
                        {error && <ErrorBox message={error} />}
                    </div>

                    <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading || !isLoaded}>
                        {loading ? <span className="flex items-center gap-2"><Spinner />Sending…</span> : "Send reset code"}
                    </Button>

                    <p className="text-center text-sm text-gray-500">
                        Remember your password?{" "}
                        <Link href="/login" className="font-semibold text-gray-900 underline-offset-2 hover:underline">Sign in</Link>
                    </p>
                </form>
            )}

            {step === "reset" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); void handleResetSubmit(); }}
                    className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 space-y-6"
                >
                    <div className="space-y-1.5 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                            <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                        </div>
                        <h1 className="text-[1.75rem] font-bold tracking-tight text-gray-900">Set new password</h1>
                        <div className="flex items-center justify-center gap-1.5">
                            <p className="text-sm text-gray-500 truncate max-w-[200px]">
                                Code sent to <span className="font-medium text-gray-700">{email}</span>
                            </p>
                            <button
                                type="button"
                                onClick={() => { setStep("email"); setError(""); setCode(""); setPassword(""); }}
                                className="shrink-0 text-xs font-medium text-gray-900 underline-offset-2 hover:underline"
                            >
                                Change
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="code" className="text-sm font-medium text-gray-700">Reset code</Label>
                            <Input
                                id="code" type="text" inputMode="numeric" autoComplete="one-time-code" required autoFocus
                                value={code} onChange={(e) => setCode(e.target.value)}
                                placeholder="123456"
                                className="h-11 text-center text-gray-900 tracking-[0.4em] font-mono text-lg placeholder:tracking-normal"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-sm font-medium text-gray-700">New password</Label>
                            <div className="relative">
                                <Input
                                    id="password" type={showPassword ? "text" : "password"}
                                    autoComplete="new-password" required
                                    value={password} onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••" className="h-11 pr-10 text-gray-900"
                                />
                                <button type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors">
                                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>

                        {error && <ErrorBox message={error} />}
                    </div>

                    <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading || !isLoaded}>
                        {loading ? <span className="flex items-center gap-2"><Spinner />Resetting…</span> : "Reset password"}
                    </Button>
                </form>
            )}
        </>
    );
}
