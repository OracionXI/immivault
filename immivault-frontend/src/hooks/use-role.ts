"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Returns the current user's role and convenience flags.
 * Safe to call before the user record loads — returns null role while loading.
 */
export function useRole() {
    const currentUser = useQuery(api.users.queries.tryGetCurrentUser);

    return {
        role: currentUser?.role ?? null,
        isAdmin: currentUser?.role === "admin",
        isCaseManager: currentUser?.role === "case_manager",
        isStaff: currentUser?.role === "staff",
        isAccountant: currentUser?.role === "accountant",
        user: currentUser ?? null,
        isLoading: currentUser === undefined,
    };
}
