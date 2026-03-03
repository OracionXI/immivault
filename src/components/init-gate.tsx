"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FullScreenLoader } from "./full-screen-loader";
import { WaitingForActivation } from "./waiting-for-activation";

/**
 * Wraps the authenticated app shell. Ensures a valid, active user record
 * exists before rendering children.
 *
 * States:
 *  - undefined  → Convex query loading → spinner
 *  - null       → No user record yet (webhook not fired) → syncing message
 *  - inactive   → Account pending admin activation → waiting page
 *  - active     → Render children
 */
export function InitGate({ children }: { children: React.ReactNode }) {
    const currentUser = useQuery(api.users.queries.tryGetCurrentUser);

    if (currentUser === undefined) {
        return <FullScreenLoader message="Setting up your workspace…" />;
    }

    if (currentUser === null) {
        return (
            <FullScreenLoader message="Syncing your account… This may take a moment." />
        );
    }

    if (currentUser.status === "inactive") {
        return (
            <WaitingForActivation
                user={{ fullName: currentUser.fullName, email: currentUser.email }}
            />
        );
    }

    return <>{children}</>;
}
