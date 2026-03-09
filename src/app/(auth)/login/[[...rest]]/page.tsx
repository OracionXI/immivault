"use client";

import { useSignIn } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "password" | "code";

export default function LoginPage() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const router = useRouter();

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handlePasswordSubmit() {
        if (!isLoaded) return;
        setError("");
        setLoading(true);
        try {
            const result = await signIn.create({
                identifier: email,
                password,
            });
            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.push("/dashboard");
            } else if (
                result.status === "needs_client_trust" ||
                result.status === "needs_second_factor"
            ) {
                await signIn.prepareSecondFactor({ strategy: "email_code" });
                setStep("code");
            }
        } catch (err: unknown) {
            const clerkErr = err as { errors?: { message: string }[] };
            setError(clerkErr.errors?.[0]?.message ?? "Incorrect password");
        } finally {
            setLoading(false);
        }
    }

    async function handleCodeSubmit() {
        if (!isLoaded) return;
        setError("");
        setLoading(true);
        try {
            const result = await signIn.attemptSecondFactor({
                strategy: "email_code",
                code,
            });
            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.push("/dashboard");
            }
        } catch (err: unknown) {
            const clerkErr = err as { errors?: { message: string }[] };
            setError(clerkErr.errors?.[0]?.message ?? "Invalid code");
        } finally {
            setLoading(false);
        }
    }

    async function resendCode() {
        if (!isLoaded) return;
        try {
            await signIn.prepareSecondFactor({ strategy: "email_code" });
        } catch (err: unknown) {
            const clerkErr = err as { errors?: { message: string }[] };
            setError(clerkErr.errors?.[0]?.message ?? "Failed to resend code");
        }
    }

    return (
        <div className="w-full max-w-sm">
            {step === "email" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); setStep("password"); }}
                    className="space-y-5"
                >
                    <div>
                        <h1 className="text-[1.375rem] font-semibold tracking-tight text-gray-900">
                            Welcome back
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Sign in to your ImmiVault account
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                            Email address
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="h-10 text-black"
                        />
                    </div>

                    <Button type="submit" className="w-full">
                        Continue
                    </Button>

                    <p className="text-center text-sm text-gray-500">
                        Don&apos;t have an account?{" "}
                        <Link href="/signup" className="font-medium text-gray-900 hover:underline">
                            Sign up
                        </Link>
                    </p>
                </form>
            )}

            {step === "password" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); void handlePasswordSubmit(); }}
                    className="space-y-5"
                >
                    <div>
                        <h1 className="text-[1.375rem] font-semibold tracking-tight text-gray-900">
                            Enter your password
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">{email}</p>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                                Password
                            </Label>
                            <Link
                                href="/forgot-password"
                                className="text-xs text-gray-500 hover:underline"
                            >
                                Forgot password?
                            </Link>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="h-10 text-black"
                            autoFocus
                        />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Signing in…" : "Sign in"}
                    </Button>

                    <button
                        type="button"
                        onClick={() => { setStep("email"); setError(""); setPassword(""); }}
                        className="w-full text-center text-sm text-gray-500 hover:underline"
                    >
                        Use a different email
                    </button>
                </form>
            )}

            {step === "code" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); void handleCodeSubmit(); }}
                    className="space-y-5"
                >
                    <div>
                        <h1 className="text-[1.375rem] font-semibold tracking-tight text-gray-900">
                            Check your email
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            We sent a verification code to{" "}
                            <span className="font-medium text-gray-700">{email}</span>
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="code" className="text-sm font-medium text-gray-700">
                            Verification code
                        </Label>
                        <Input
                            id="code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            required
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="123456"
                            className="h-10 text-black tracking-widest"
                            autoFocus
                        />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Verifying…" : "Verify & sign in"}
                    </Button>

                    <button
                        type="button"
                        onClick={() => void resendCode()}
                        className="w-full text-center text-sm text-gray-500 hover:underline"
                    >
                        Resend code
                    </button>
                </form>
            )}
        </div>
    );
}
