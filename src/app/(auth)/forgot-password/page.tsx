"use client";

import { useSignIn } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "reset";

export default function ForgotPasswordPage() {
    const { isLoaded, signIn, setActive } = useSignIn();
    const router = useRouter();

    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleEmailSubmit() {
        if (!isLoaded) return;
        setError("");
        setLoading(true);
        try {
            await signIn.create({
                strategy: "reset_password_email_code",
                identifier: email,
            });
            setStep("reset");
        } catch (err: unknown) {
            const clerkErr = err as { errors?: { message: string }[] };
            setError(clerkErr.errors?.[0]?.message ?? "Could not send reset email. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleResetSubmit() {
        if (!isLoaded) return;
        setError("");
        setLoading(true);
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
            const clerkErr = err as { errors?: { message: string }[] };
            setError(clerkErr.errors?.[0]?.message ?? "Password reset failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="w-full max-w-sm">
            {step === "email" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); void handleEmailSubmit(); }}
                    className="space-y-5"
                >
                    <div>
                        <h1 className="text-[1.375rem] font-semibold tracking-tight text-gray-900">
                            Forgot your password?
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Enter your email and we&apos;ll send you a reset code.
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
                            autoFocus
                        />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button type="submit" className="w-full" disabled={loading || !isLoaded}>
                        {loading ? "Sending…" : "Send reset code"}
                    </Button>

                    <p className="text-center text-sm text-gray-500">
                        Remember your password?{" "}
                        <Link href="/login" className="font-medium text-gray-900 hover:underline">
                            Sign in
                        </Link>
                    </p>
                </form>
            )}

            {step === "reset" && (
                <form
                    onSubmit={(e) => { e.preventDefault(); void handleResetSubmit(); }}
                    className="space-y-5"
                >
                    <div>
                        <h1 className="text-[1.375rem] font-semibold tracking-tight text-gray-900">
                            Set new password
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            We sent a reset code to{" "}
                            <span className="font-medium text-gray-700">{email}</span>
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="code" className="text-sm font-medium text-gray-700">
                            Reset code
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

                    <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                            New password
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="h-10 text-black"
                        />
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button type="submit" className="w-full" disabled={loading || !isLoaded}>
                        {loading ? "Resetting…" : "Reset password"}
                    </Button>

                    <button
                        type="button"
                        onClick={() => { setStep("email"); setError(""); setCode(""); setPassword(""); }}
                        className="w-full text-center text-sm text-gray-500 hover:underline"
                    >
                        Use a different email
                    </button>
                </form>
            )}
        </div>
    );
}
