"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ShieldX, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LicenseRevoked() {
    const { signOut } = useClerk();
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
                    {/* Icon */}
                    <div className="flex justify-center">
                        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                            <ShieldX className="h-8 w-8 text-destructive" />
                        </div>
                    </div>

                    {/* Text */}
                    <div className="text-center space-y-2">
                        <h1 className="text-xl font-semibold tracking-tight">
                            Your licence has been revoked
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Your access to this workspace has been revoked by an administrator.
                            Please contact your administrator if you believe this is a mistake.
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
            </div>
        </div>
    );
}
