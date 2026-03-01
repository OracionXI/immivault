"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";

export default function OnboardingPage() {
    const router = useRouter();
    const { createOrganization, isLoaded } = useOrganizationList();
    const [orgName, setOrgName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const pending = sessionStorage.getItem("pendingOrgName");
        if (pending) setOrgName(pending);
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !createOrganization) return;
        setLoading(true);
        setError("");
        try {
            await createOrganization({ name: orgName });
            sessionStorage.removeItem("pendingOrgName");
            router.push("/dashboard");
        } catch (err: unknown) {
            const clerkError = err as { errors?: { message: string }[] };
            setError(clerkError.errors?.[0]?.message ?? "Failed to create workspace. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-[400px]">
                <div className="mb-8 flex flex-col items-center text-center">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-primary-foreground" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" strokeLinejoin="round" />
                            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Set up your law firm</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        This creates your workspace. You can add staff members after setup.
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 rounded-lg px-3.5 py-2.5 text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                        {error}
                    </div>
                )}

                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Law firm name</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Smith & Associates Law Firm"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                        />
                        <p className="text-xs text-muted-foreground">This will be the name of your ImmiVault workspace.</p>
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !orgName.trim() || !isLoaded}
                        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? "Creating workspace…" : "Create workspace"}
                    </button>
                </form>
            </div>
        </div>
    );
}
