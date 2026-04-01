"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FullScreenLoader } from "@/components/full-screen-loader";
import { WaitingForActivation } from "@/components/waiting-for-activation";

/**
 * Waiting page for invited staff members who have signed up but are pending
 * admin activation.
 *
 * Subscribes to the user's Convex record in real-time. As soon as the admin
 * activates the account (status → "active"), this page automatically
 * redirects to /welcome, which then carries the user through to /dashboard.
 */
export default function WaitingPage() {
    const router = useRouter();
    const currentUser = useQuery(api.users.queries.tryGetCurrentUser);

    useEffect(() => {
        if (currentUser === undefined || currentUser === null) return;

        if (currentUser.status === "pending_onboarding") {
            router.push("/onboarding");
            return;
        }

        if (currentUser.status === "active") {
            // Account has been activated — send to the welcome animation
            router.push("/welcome");
        }
    }, [currentUser, router]);

    // Loading states
    if (currentUser === undefined || currentUser === null) {
        return <FullScreenLoader message="Loading your account…" />;
    }

    // Redirecting away
    if (currentUser.status !== "inactive") {
        return <FullScreenLoader message="Redirecting…" />;
    }

    return (
        <WaitingForActivation
            user={{ fullName: currentUser.fullName, email: currentUser.email }}
        />
    );
}
