"use client";

import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SignupForm() {
    const { isLoaded, signUp } = useSignUp();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const ticket = searchParams.get("__clerk_ticket");
        if (ticket) {
            router.replace(`/invite?__clerk_ticket=${ticket}`);
        }
    }, [searchParams, router]);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        if (!isLoaded) return;
        setError("");
        setLoading(true);
        try {
            await signUp.create({
                firstName,
                lastName,
                emailAddress: email,
                username,
                password,
            });
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            router.push("/verify");
        } catch (err: unknown) {
            const clerkErr = err as { errors?: { message: string }[] };
            setError(clerkErr.errors?.[0]?.message ?? "Sign up failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="w-full max-w-sm">
            <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="space-y-5">
                <div>
                    <h1 className="text-[1.375rem] font-semibold tracking-tight text-gray-900">
                        Create your account
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Start managing immigration cases today
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                            First name
                        </Label>
                        <Input
                            id="firstName"
                            type="text"
                            autoComplete="given-name"
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="John"
                            className="h-10 text-black"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                            Last name
                        </Label>
                        <Input
                            id="lastName"
                            type="text"
                            autoComplete="family-name"
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Doe"
                            className="h-10 text-black"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                        Username
                    </Label>
                    <Input
                        id="username"
                        type="text"
                        autoComplete="username"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                        placeholder="johndoe"
                        className="h-10 text-black"
                    />
                    <p className="text-xs text-gray-400">Must be unique across all accounts.</p>
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

                <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                        Password
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
                    {loading ? "Creating account…" : "Create account"}
                </Button>

                <p className="text-center text-sm text-gray-500">
                    Already have an account?{" "}
                    <Link href="/login" className="font-medium text-gray-900 hover:underline">
                        Sign in
                    </Link>
                </p>
            </form>
        </div>
    );
}

export default function SignupPage() {
    return (
        <Suspense>
            <SignupForm />
        </Suspense>
    );
}
