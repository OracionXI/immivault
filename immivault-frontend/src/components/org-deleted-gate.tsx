"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { LicenseRevoked } from "./license-revoked";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface OrgDeletedGateProps {
    deletedAt: number;
}

export function OrgDeletedGate({ deletedAt }: OrgDeletedGateProps) {
    const reactivateOrg = useMutation(api.organisations.mutations.reactivateOrg);
    const [open, setOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const daysRemaining = Math.max(
        0,
        Math.floor((deletedAt + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))
    );

    const deletedDate = new Date(deletedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    const handleReactivate = async () => {
        setLoading(true);
        setError("");
        try {
            await reactivateOrg({});
            // InitGate reactivity will pick up the change and restore access
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to reactivate. Please try again.");
            setLoading(false);
        }
    };

    return (
        <>
            <LicenseRevoked />

            <Dialog open={open} onOpenChange={() => {}}>
                <DialogContent
                    className="sm:max-w-[460px]"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Organisation Scheduled for Deletion</DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <p>
                                    This organisation was deleted on{" "}
                                    <span className="font-medium text-foreground">{deletedDate}</span>.
                                </p>
                                <p>
                                    You have{" "}
                                    <span className="font-semibold text-foreground">
                                        {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
                                    </span>{" "}
                                    remaining to recover it before all data — including staff accounts, cases,
                                    documents, and billing records — is permanently and irreversibly deleted.
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>

                    {error && (
                        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                            {error}
                        </p>
                    )}

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                            className="sm:flex-1"
                        >
                            Dismiss
                        </Button>
                        <Button
                            onClick={handleReactivate}
                            disabled={loading || daysRemaining === 0}
                            className="sm:flex-1"
                        >
                            {loading ? "Reactivating…" : "Reactivate Organisation"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
