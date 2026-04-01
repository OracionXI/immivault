"use client";

import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function InviteForm() {
    const { isLoaded, signUp, setActive } = useSignUp();
    const router = useRouter();
    const searchParams = useSearchParams();
    const ticket = searchParams.get("__clerk_ticket") ?? "";
    const orgName = searchParams.get("orgName") ?? "";

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        if (!isLoaded) return;
        if (password !== confirmPassword) { setError("Passwords do not match."); return; }
        setError(""); setLoading(true);
        try {
            const result = await signUp.create({ strategy: "ticket", ticket, firstName, lastName, username, password });
            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.push("/waiting");
            }
        } catch (err: unknown) {
            const e = err as { errors?: { message: string }[] };
            setError(e.errors?.[0]?.message ?? "Failed to accept invite. Please try again.");
        } finally { setLoading(false); }
    }

    if (!ticket) {
        return (
            <div className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
                    <svg className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-[1.75rem] font-bold tracking-tight text-gray-900">Invalid invite link</h1>
                    <p className="mt-1.5 text-sm text-gray-500">
                        This invite link is missing or has expired. Please ask your administrator to resend the invite.
                    </p>
                </div>
                <Link href="/login" className="inline-block text-sm font-semibold text-gray-900 underline-offset-2 hover:underline">
                    Back to sign in
                </Link>
            </div>
        );
    }

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
            className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 space-y-5"
        >
            <div className="space-y-1.5 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50">
                    <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <line x1="19" y1="8" x2="19" y2="14" />
                        <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                </div>
                <h1 className="text-[1.75rem] font-bold tracking-tight text-gray-900">Accept your invitation</h1>
                <p className="text-sm text-gray-500">
                    {orgName
                        ? <>You&apos;ve been invited to join <span className="font-semibold text-gray-700">{orgName}</span>. Set up your account below.</>
                        : "Set up your account to join your team."
                    }
                </p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">First name</Label>
                        <Input
                            id="firstName" type="text" autoComplete="given-name" required autoFocus
                            value={firstName} onChange={(e) => setFirstName(e.target.value)}
                            placeholder="John" className="h-11 text-gray-900 placeholder:text-gray-400"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last name</Label>
                        <Input
                            id="lastName" type="text" autoComplete="family-name" required
                            value={lastName} onChange={(e) => setLastName(e.target.value)}
                            placeholder="Doe" className="h-11 text-gray-900 placeholder:text-gray-400"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm font-medium text-gray-700">Username</Label>
                    <Input
                        id="username" type="text" autoComplete="username" required
                        value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                        placeholder="johndoe" className="h-11 text-gray-900 placeholder:text-gray-400"
                    />
                    <p className="text-xs text-gray-400">Must be unique across all accounts.</p>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">Create a password</Label>
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

                <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm password</Label>
                    <div className="relative">
                        <Input
                            id="confirmPassword" type={showConfirm ? "text" : "password"}
                            autoComplete="new-password" required
                            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••" className="h-11 pr-10 text-gray-900"
                        />
                        <button type="button" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}
                            aria-label={showConfirm ? "Hide password" : "Show password"}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors">
                            {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                    </div>
                </div>

                {error && <ErrorBox message={error} />}
            </div>

            <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading || !isLoaded}>
                {loading ? <span className="flex items-center gap-2"><Spinner />Setting up…</span> : "Accept invitation"}
            </Button>

            <p className="text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-gray-900 underline-offset-2 hover:underline">Sign in</Link>
            </p>
        </form>
    );
}

export default function InviteSignUpPage() {
    return (
        <Suspense>
            <InviteForm />
        </Suspense>
    );
}
