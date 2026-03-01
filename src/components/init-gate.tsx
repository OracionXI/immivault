"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Loader2 } from "lucide-react";

/**
 * Wraps the app and auto-detects when the current Clerk user has no Convex
 * user record yet (e.g. webhook not configured in dev). Shows a one-time
 * setup form that calls seed.initCurrentUser from the browser session so the
 * Clerk JWT is present.
 */
export function InitGate({ children }: { children: React.ReactNode }) {
    const currentUser = useQuery(api.users.queries.tryGetCurrentUser);
    const initUser = useMutation(api.seed.initCurrentUser);

    const [orgName, setOrgName] = useState("");
    const [fullName, setFullName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Still loading — wait
    if (currentUser === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // User record exists — render the app normally
    if (currentUser !== null) {
        return <>{children}</>;
    }

    // No user record — show one-time setup form
    const handleInit = async () => {
        if (!orgName.trim() || !fullName.trim()) {
            setError("Both fields are required.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await initUser({ orgName: orgName.trim(), fullName: fullName.trim() });
            // useQuery will re-run and currentUser will become non-null,
            // causing this component to render children automatically.
        } catch (e) {
            setError(e instanceof Error ? e.message : "Setup failed. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-3">
                        <div className="p-3 rounded-xl bg-primary/10">
                            <Building2 className="h-7 w-7 text-primary" />
                        </div>
                    </div>
                    <CardTitle>Set up your workspace</CardTitle>
                    <CardDescription>
                        Your account is authenticated but hasn&apos;t been synced to the
                        database yet. Enter your details to complete setup.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Your Full Name</Label>
                        <Input
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="e.g. Sarah Chen"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="orgName">Organisation / Firm Name</Label>
                        <Input
                            id="orgName"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="e.g. Chen Immigration Law"
                        />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button className="w-full" onClick={handleInit} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Complete Setup
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                        This screen only appears in development when the Clerk webhook
                        hasn&apos;t been configured yet.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
