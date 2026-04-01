"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs/legacy";
import { Button } from "@/components/ui/button";

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

export default function VerifyPage() {
    const router = useRouter();
    const { signUp, setActive, isLoaded } = useSignUp();
    const [digits, setDigits] = useState(["", "", "", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [loading, setLoading] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [error, setError] = useState("");

    const code = digits.join("");

    function handleDigitChange(index: number, value: string) {
        const digit = value.replace(/\D/g, "").slice(-1);
        const next = [...digits];
        next[index] = digit;
        setDigits(next);
        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    }

    function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace") {
            if (digits[index]) {
                const next = [...digits];
                next[index] = "";
                setDigits(next);
            } else if (index > 0) {
                inputRefs.current[index - 1]?.focus();
            }
        } else if (e.key === "ArrowLeft" && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowRight" && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    }

    function handlePaste(e: React.ClipboardEvent) {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        const next = [...digits];
        pasted.split("").forEach((ch, i) => { next[i] = ch; });
        setDigits(next);
        const focusIndex = Math.min(pasted.length, 5);
        inputRefs.current[focusIndex]?.focus();
    }

    async function handleVerify() {
        if (!isLoaded || !signUp) return;
        setLoading(true); setError("");
        try {
            const result = await signUp.attemptEmailAddressVerification({ code });
            if (result.status === "complete") {
                setRedirecting(true);
                await setActive({ session: result.createdSessionId });
                router.push("/onboarding");
            } else {
                setError("Verification incomplete. Please try again or request a new code.");
            }
        } catch (err: unknown) {
            const e = err as { errors?: { message: string }[] };
            setError(e.errors?.[0]?.message ?? "Verification failed. Please try again.");
        } finally { setLoading(false); }
    }

    async function handleResend() {
        if (!isLoaded || !signUp) return;
        try {
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        } catch (err: unknown) {
            const e = err as { errors?: { message: string }[] };
            setError(e.errors?.[0]?.message ?? "Failed to resend code.");
        }
    }

    if (isLoaded && !signUp) {
        return (
            <div className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 space-y-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
                    <svg className="h-6 w-6 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-[1.75rem] font-bold tracking-tight text-gray-900">Session expired</h1>
                    <p className="mt-1.5 text-sm text-gray-500">Your sign-up session is no longer active. Please start again.</p>
                </div>
                <Button className="h-11 w-full rounded-xl" onClick={() => router.push("/signup")}>
                    Back to sign up
                </Button>
            </div>
        );
    }

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); void handleVerify(); }}
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
                    We sent a 6-digit verification code to your email address.
                </p>
            </div>

            {/* Individual OTP digit boxes */}
            <div>
                <div className="flex items-center justify-center gap-2.5">
                    {digits.map((digit, i) => (
                        <input
                            key={i}
                            ref={(el) => { inputRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            autoComplete={i === 0 ? "one-time-code" : "off"}
                            maxLength={1}
                            value={digit}
                            autoFocus={i === 0}
                            onChange={(e) => handleDigitChange(i, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(i, e)}
                            onPaste={i === 0 ? handlePaste : undefined}
                            onFocus={(e) => e.target.select()}
                            className={[
                                "h-14 w-12 rounded-xl border text-center font-mono text-xl font-semibold text-gray-900 outline-none transition-all duration-150",
                                "placeholder:text-gray-300",
                                digit
                                    ? "border-gray-900 bg-white shadow-sm ring-1 ring-gray-900"
                                    : "border-gray-200 bg-gray-50 hover:border-gray-300",
                                "focus:border-gray-900 focus:bg-white focus:shadow-sm focus:ring-1 focus:ring-gray-900",
                            ].join(" ")}
                        />
                    ))}
                </div>
            </div>

            {error && <ErrorBox message={error} />}

            <Button
                type="submit"
                className="h-11 w-full rounded-xl"
                disabled={loading || redirecting || code.length < 6 || !isLoaded || !signUp}
            >
                {redirecting
                    ? <span className="flex items-center gap-2"><Spinner />Redirecting…</span>
                    : loading
                        ? <span className="flex items-center gap-2"><Spinner />Verifying…</span>
                        : "Verify email"}
            </Button>

            <p className="text-center text-sm text-gray-500">
                Didn&apos;t receive it?{" "}
                <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={!isLoaded}
                    className="font-semibold text-gray-900 underline-offset-2 hover:underline disabled:opacity-50"
                >
                    Resend code
                </button>
            </p>
        </form>
    );
}
