"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Backend integration will be added later
        setSubmitted(true);
    };

    return (
        <div className="w-full max-w-[360px]">
            {/* Logo */}
            <div className="mb-8 flex flex-col items-center">
                <div
                    className="mb-5 flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ background: "#181925" }}
                >
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" strokeLinejoin="round" />
                        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <h1
                    className="text-[1.375rem] font-semibold tracking-tight"
                    style={{ color: "var(--auth-fg-4)" }}
                >
                    Reset your password
                </h1>
                <p className="mt-1 text-center text-sm leading-relaxed" style={{ color: "var(--auth-fg-3)" }}>
                    Enter your email and we&rsquo;ll send you a link to reset your password.
                </p>
            </div>

            {submitted ? (
                /* Success state */
                <div className="space-y-5">
                    <div
                        className="flex flex-col items-center gap-3 rounded-xl px-6 py-6 text-center"
                        style={{ background: "var(--auth-gray-1)", border: "1px solid var(--auth-gray-2)" }}
                    >
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                        <div>
                            <p className="text-sm font-medium" style={{ color: "var(--auth-fg-4)" }}>
                                Check your inbox
                            </p>
                            <p className="mt-1 text-sm" style={{ color: "var(--auth-fg-3)" }}>
                                We sent a reset link to{" "}
                                <span className="font-medium" style={{ color: "var(--auth-fg-4)" }}>
                                    {email}
                                </span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSubmitted(false)}
                        className="w-full rounded-lg py-2.5 text-sm transition-colors hover:bg-gray-50"
                        style={{
                            border: "1px solid var(--auth-gray-2)",
                            color: "var(--auth-fg-3)",
                            boxShadow: "var(--auth-shadow-1)",
                        }}
                    >
                        Resend email
                    </button>
                </div>
            ) : (
                /* Form state */
                <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                        type="email"
                        required
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
                        style={{
                            background: "var(--auth-bg-1)",
                            border: "1px solid var(--auth-gray-2)",
                            color: "var(--auth-fg-4)",
                            boxShadow: "var(--auth-shadow-1)",
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--auth-gray-2)")}
                    />
                    <button
                        type="submit"
                        className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
                        style={{ background: "oklch(0.455 0.188 264.1)" }}
                    >
                        Send reset link
                    </button>
                </form>
            )}

            {/* Back to login */}
            <div className="mt-6 flex justify-center">
                <Link
                    href="/login"
                    className="flex items-center gap-1.5 text-sm transition-colors hover:underline"
                    style={{ color: "var(--auth-fg-3)" }}
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to log in
                </Link>
            </div>
        </div>
    );
}
