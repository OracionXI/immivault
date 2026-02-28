"use client";

import { useState } from "react";
import Link from "next/link";

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

const GitHubIcon = () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
);

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Backend integration will be added later
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
                    Log in to ImmiVault
                </h1>
                <p className="mt-1 text-sm" style={{ color: "var(--auth-fg-3)" }}>
                    Professional immigration case management.
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
                {/* Email */}
                <input
                    type="email"
                    required
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-offset-0"
                    style={{
                        background: "var(--auth-bg-1)",
                        border: "1px solid var(--auth-gray-2)",
                        color: "var(--auth-fg-4)",
                        boxShadow: "var(--auth-shadow-1)",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--auth-gray-2)")}
                />

                {/* Password */}
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg px-3.5 py-2.5 pr-10 text-sm outline-none transition-shadow"
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
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                        style={{ color: "var(--auth-fg-2)" }}
                        onClick={() => setShowPassword((v) => !v)}
                    >
                        {showPassword ? "Hide" : "Show"}
                    </button>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end">
                    <Link
                        href="/forgot-password"
                        className="text-xs transition-colors hover:underline"
                        style={{ color: "var(--auth-fg-3)" }}
                    >
                        Forgot password?
                    </Link>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
                    style={{ background: "oklch(0.455 0.188 264.1)" }}
                >
                    Continue with email
                </button>
            </form>

            {/* Divider */}
            <div className="relative my-5 flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: "var(--auth-gray-2)" }} />
                <span className="text-xs" style={{ color: "var(--auth-fg-2)" }}>or</span>
                <div className="h-px flex-1" style={{ background: "var(--auth-gray-2)" }} />
            </div>

            {/* OAuth */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
                    style={{
                        border: "1px solid var(--auth-gray-2)",
                        color: "var(--auth-fg-4)",
                        boxShadow: "var(--auth-shadow-1)",
                    }}
                >
                    <GoogleIcon />
                    Google
                </button>
                <button
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
                    style={{
                        border: "1px solid var(--auth-gray-2)",
                        color: "var(--auth-fg-4)",
                        boxShadow: "var(--auth-shadow-1)",
                    }}
                >
                    <GitHubIcon />
                    GitHub
                </button>
            </div>

            {/* Footer */}
            <p className="mt-6 text-center text-sm" style={{ color: "var(--auth-fg-3)" }}>
                Don&rsquo;t have an account?{" "}
                <Link
                    href="/signup"
                    className="font-medium transition-colors hover:underline"
                    style={{ color: "var(--auth-fg-4)" }}
                >
                    Register
                </Link>
            </p>
        </div>
    );
}
