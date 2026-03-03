"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WaitingForActivationProps {
    user: { fullName: string; email: string };
}

export function WaitingForActivation({ user }: WaitingForActivationProps) {
    const { signOut } = useClerk();
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
                    {/* Icon */}
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <ShieldCheck className="h-8 w-8 text-primary" />
                            </div>
                            {/* Animated ping */}
                            <span className="absolute top-0 right-0 h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
                            </span>
                        </div>
                    </div>

                    {/* Text */}
                    <div className="text-center space-y-2">
                        <h1 className="text-xl font-semibold tracking-tight">
                            Account Pending Activation
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Welcome,{" "}
                            <span className="font-medium text-foreground">{user.fullName}</span>.
                            Your account has been created and is awaiting activation
                            by your administrator.
                        </p>
                    </div>

                    {/* Info box */}
                    <div className="rounded-lg bg-muted/50 border border-border/60 px-4 py-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Signed in as
                        </p>
                        <p className="text-sm font-medium">{user.email}</p>
                    </div>

                    {/* Auto-redirect notice */}
                    <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                        <p>
                            You&apos;ll be redirected to the dashboard automatically
                            the moment your account is activated — no need to refresh.
                        </p>
                    </div>

                    {/* Sign out */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground hover:text-foreground gap-2"
                        onClick={() => signOut(() => router.push("/login"))}
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                    </Button>
                </div>

                {/* Footer note */}
                <p className="text-center text-xs text-muted-foreground mt-4">
                    Contact your administrator if you believe this is a mistake.
                </p>
            </div>
        </div>
    );
}
