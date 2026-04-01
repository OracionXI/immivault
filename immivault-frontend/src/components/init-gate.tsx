"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FullScreenLoader } from "./full-screen-loader";

/**
 * Wraps the authenticated app shell. Ensures a valid, active user record
 * exists before rendering children.
 *
 * States:
 *  - undefined          → Convex query loading → spinner
 *  - null               → No user record yet (webhook not fired) → syncing message
 *  - pending_onboarding → Admin hasn't completed org setup → redirect to /onboarding
 *  - inactive           → Account awaiting admin activation → redirect to /waiting
 *  - active             → Render children
 */
export function InitGate({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const currentUser = useQuery(api.users.queries.tryGetCurrentUser);

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.status === "pending_onboarding") {
            router.push("/onboarding");
        } else if (currentUser.status === "inactive") {
            router.push("/waiting");
        }
    }, [currentUser, router]);

    if (currentUser === undefined) {
        return <FullScreenLoader message="Setting up your workspace…" />;
    }

    if (currentUser === null) {
        return (
            <FullScreenLoader message="Syncing your account… This may take a moment." />
        );
    }

    if (currentUser.status !== "active") {
        return <FullScreenLoader message="Redirecting…" />;
    }

    return <>{children}</>;
}
