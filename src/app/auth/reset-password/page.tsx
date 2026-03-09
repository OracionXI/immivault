"use client";

import { useSignIn } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
    const router = useRouter();
    const { signIn, setActive, isLoaded } = useSignIn();
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleReset() {
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
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-white px-6">
            <div className="w-full max-w-sm">
                <form
                    onSubmit={(e) => { e.preventDefault(); void handleReset(); }}
                    className="space-y-5"
                >
                    <div>
                        <h1 className="text-[1.375rem] font-semibold tracking-tight text-gray-900">
                            Set new password
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Enter the code from your email and choose a new password.
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
                </form>
            </div>
        </div>
    );
}
