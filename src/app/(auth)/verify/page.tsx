"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs/legacy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VerifyPage() {
    const router = useRouter();
    const { signUp, setActive, isLoaded } = useSignUp();
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleVerify() {
        if (!isLoaded || !signUp) return;
        setLoading(true);
        setError("");
        try {
            const result = await signUp.attemptEmailAddressVerification({ code });
            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.push("/onboarding");
            } else {
                setError("Verification incomplete. Please try again or request a new code.");
            }
        } catch (err: unknown) {
            const clerkError = err as { errors?: { message: string }[] };
            setError(clerkError.errors?.[0]?.message ?? "Verification failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleResend() {
        if (!isLoaded || !signUp) return;
        try {
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        } catch (err: unknown) {
            const clerkError = err as { errors?: { message: string }[] };
            setError(clerkError.errors?.[0]?.message ?? "Failed to resend code.");
        }
    }

    // If signUp is gone (e.g. page was refreshed), guide user back
    if (isLoaded && !signUp) {
        return (
            <div className="w-full max-w-sm space-y-5">
                <div>
                    <h1 className="text-[1.375rem] font-semibold tracking-tight text-gray-900">
                        Session expired
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Your sign-up session is no longer active. Please start again.
                    </p>
                </div>
                <Button className="w-full" onClick={() => router.push("/signup")}>
                    Back to sign up
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm">
            <form
                onSubmit={(e) => { e.preventDefault(); void handleVerify(); }}
                className="space-y-5"
            >
                <div>
                    <h1 className="text-[1.375rem] font-semibold tracking-tight text-gray-900">
                        Check your email
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        We sent a 6-digit verification code to your email address.
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
                        maxLength={6}
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        className="h-10 text-black text-center tracking-[0.5em] font-mono text-lg"
                        autoFocus
                    />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || code.length < 6 || !isLoaded || !signUp}
                >
                    {loading ? "Verifying…" : "Verify email"}
                </Button>

                <p className="text-center text-sm text-gray-500">
                    Didn&apos;t receive it?{" "}
                    <button
                        type="button"
                        onClick={() => void handleResend()}
                        disabled={!isLoaded}
                        className="font-medium text-gray-900 hover:underline disabled:opacity-60"
                    >
                        Resend code
                    </button>
                </p>
            </form>
        </div>
    );
}
