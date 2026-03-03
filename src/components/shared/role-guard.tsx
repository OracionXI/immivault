"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";

type Role = "admin" | "case_manager" | "staff";

interface RoleGuardProps {
    allowedRoles: Role[];
    redirectTo?: string;
    children: React.ReactNode;
}

/**
 * Renders children only when the current user's role is in allowedRoles.
 * Returns null while loading (prevents flash) and while unauthorized (redirect fires in useEffect).
 */
export function RoleGuard({ allowedRoles, redirectTo = "/dashboard", children }: RoleGuardProps) {
    const { role, isLoading } = useRole();
    const router = useRouter();

    const authorized = !isLoading && role !== undefined && allowedRoles.includes(role as Role);

    useEffect(() => {
        if (!isLoading && role !== undefined && !allowedRoles.includes(role as Role)) {
            router.replace(redirectTo);
        }
    }, [isLoading, role, redirectTo, router]);

    if (!authorized) return null;

    return <>{children}</>;
}
