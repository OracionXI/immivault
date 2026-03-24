"use client";

import { useSignIn } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "password" | "code";

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

export default function LoginPage() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const router = useRouter();

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handlePasswordSubmit() {
        if (!isLoaded) return;
        setError(""); setLoading(true);
        try {
            const result = await signIn.create({ identifier: email, password });
            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.push("/dashboard");
            } else if (result.status === "needs_client_trust" || result.status === "needs_second_factor") {
                await signIn.prepareSecondFactor({ strategy: "email_code" });
                setStep("code");
            }
        } catch (err: unknown) {
            const e = err as { errors?: { message: string }[] };
            setError(e.errors?.[0]?.message ?? "Incorrect password");
        } finally { setLoading(false); }
    }

    async function handleCodeSubmit() {
        if (!isLoaded) return;
        setError(""); setLoading(true);
        try {
            const result = await signIn.attemptSecondFactor({ strategy: "email_code", code });
            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.push("/dashboard");
            }
        } catch (err: unknown) {
            const e = err as { errors?: { message: string }[] };
            setError(e.errors?.[0]?.message ?? "Invalid code");
        } finally { setLoading(false); }
    }

    async function resendCode() {
        if (!isLoaded || loading) return;
        setError("");
        setLoading(true);
        try {
            await signIn.prepareSecondFactor({ strategy: "email_code" });
        } catch (err: unknown) {
            const e = err as { errors?: { message: string }[] };
            setError(e.errors?.[0]?.message ?? "Failed to resend code");
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            {step === "email" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); setStep("password"); }}
                    className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 space-y-6"
                >
                    <div className="space-y-1.5 text-center">
                        <h1 className="text-[1.75rem] font-bold tracking-tight text-gray-900">
                            Welcome back
                        </h1>
                        <p className="text-sm text-gray-500">Sign in to your Ordena account</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email address</Label>
                            <Input
                                id="email" type="email" autoComplete="email" required autoFocus
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="h-11 text-gray-900 placeholder:text-gray-400"
                            />
                        </div>
                    </div>

                    <Button type="submit" className="h-11 w-full rounded-xl">Continue</Button>

                    <p className="text-center text-sm text-gray-500">
                        Don&apos;t have an account?{" "}
                        <Link href="/signup" className="font-semibold text-gray-900 underline-offset-2 hover:underline">
                            Sign up
                        </Link>
                    </p>
                </form>
            )}

            {step === "password" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); void handlePasswordSubmit(); }}
                    className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 space-y-6"
                >
                    <div className="space-y-1.5 text-center">
                        <h1 className="text-[1.75rem] font-bold tracking-tight text-gray-900">
                            Enter your password
                        </h1>
                        <div className="flex items-center justify-center gap-1.5">
                            <span className="text-sm text-gray-500 truncate max-w-[200px]">{email}</span>
                            <button
                                type="button"
                                onClick={() => { setStep("email"); setError(""); setPassword(""); }}
                                className="text-xs font-medium text-gray-900 underline-offset-2 hover:underline"
                            >
                                Change
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                                <Link href="/forgot-password" className="text-xs text-gray-500 underline-offset-2 hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password" type={showPassword ? "text" : "password"}
                                    autoComplete="current-password" required autoFocus
                                    value={password} onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-11 pr-10 text-gray-900"
                                />
                                <button
                                    type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>

                        {error && <ErrorBox message={error} />}
                    </div>

                    <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading || !isLoaded}>
                        {loading ? <span className="flex items-center gap-2"><Spinner />Signing in…</span> : "Sign in"}
                    </Button>
                </form>
            )}

            {step === "code" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); void handleCodeSubmit(); }}
                    className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 space-y-6"
                >
                    <div className="space-y-1.5 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                            <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                        </div>
                        <h1 className="text-[1.75rem] font-bold tracking-tight text-gray-900">Check your email</h1>
                        <p className="text-sm text-gray-500">
                            We sent a 6-digit code to{" "}
                            <span className="font-medium text-gray-700">{email}</span>
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="code" className="text-sm font-medium text-gray-700">Verification code</Label>
                            <Input
                                id="code" type="text" inputMode="numeric" autoComplete="one-time-code" required autoFocus
                                value={code} onChange={(e) => setCode(e.target.value)}
                                placeholder="123456"
                                className="h-11 text-center text-gray-900 tracking-[0.4em] font-mono text-lg placeholder:tracking-normal"
                            />
                        </div>
                        {error && <ErrorBox message={error} />}
                    </div>

                    <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading || !isLoaded}>
                        {loading ? <span className="flex items-center gap-2"><Spinner />Verifying…</span> : "Verify & sign in"}
                    </Button>

                    <p className="text-center text-sm text-gray-500">
                        Didn&apos;t receive it?{" "}
                        <button
                            type="button"
                            onClick={() => void resendCode()}
                            disabled={loading}
                            className="font-semibold text-gray-900 underline-offset-2 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Sending…" : "Resend code"}
                        </button>
                    </p>
                </form>
            )}
        </>
    );
}
