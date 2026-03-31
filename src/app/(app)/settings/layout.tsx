"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { User, GitBranch, Layers, Building2, FileText, Shield, CalendarClock, CreditCard, Globe, DollarSign } from "lucide-react";
import { useRole } from "@/hooks/use-role";

type VisibleTo = "all" | "admin" | "admin_cm";
type Tab = { title: string; href: string; icon: React.ElementType; visibleTo: VisibleTo };

const settingsCategories: { label: string; items: Tab[] }[] = [
    {
        label: "General",
        items: [
            { title: "Profile",         href: "/settings",                    icon: User,          visibleTo: "all"      },
            { title: "My Availability", href: "/settings/my-availability",    icon: CalendarClock, visibleTo: "admin_cm" },
        ],
    },
    {
        label: "Project",
        items: [
            { title: "Case Stages",  href: "/settings/case-stages",         icon: GitBranch,     visibleTo: "admin" },
            { title: "Case Types",   href: "/settings/case-types",          icon: Layers,        visibleTo: "admin" },
            { title: "Doc Types",    href: "/settings/doc-types",           icon: FileText,      visibleTo: "admin" },
            { title: "Appt Types",   href: "/settings/appointment-types",   icon: CalendarClock, visibleTo: "admin" },
            { title: "Appt Pricing", href: "/settings/appointment-pricing", icon: DollarSign,    visibleTo: "admin" },
        ],
    },
    {
        label: "Management",
        items: [
            { title: "Role Types",    href: "/settings/role-types",   icon: Shield,    visibleTo: "admin" },
            { title: "Bank Accounts", href: "/settings/bank-accounts", icon: Building2, visibleTo: "admin" },
            { title: "Payments",      href: "/payments/settings",      icon: CreditCard, visibleTo: "admin" },
            { title: "Client Portal", href: "/settings/portal",        icon: Globe,     visibleTo: "admin" },
        ],
    },
];

// Flatten for CM_ALLOWED_PATHS check
const CM_ALLOWED_PATHS = ["/settings/my-availability"];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAdmin, isCaseManager, isLoading } = useRole();

    const canAccessPath = isAdmin || pathname === "/settings" || (isCaseManager && CM_ALLOWED_PATHS.some((p) => pathname.startsWith(p)));

    useEffect(() => {
        if (!isLoading && !canAccessPath) {
            router.replace("/settings");
        }
    }, [isLoading, canAccessPath, router]);

    const isVisible = (visibleTo: VisibleTo) => {
        if (visibleTo === "all") return true;
        if (visibleTo === "admin") return isAdmin;
        if (visibleTo === "admin_cm") return isAdmin || isCaseManager;
        return false;
    };

    return (
        <div className="space-y-6 pb-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your application configuration</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Settings Sidebar */}
                <nav className="w-full md:w-56 shrink-0">
                    {/* Mobile: horizontal scroll strip */}
                    <div className="flex md:hidden gap-1 overflow-x-auto pb-2 scrollbar-none">
                        {settingsCategories.flatMap((cat) =>
                            cat.items.filter((tab) => isVisible(tab.visibleTo)).map((tab) => {
                                const isActive = pathname === tab.href || (tab.href !== "/settings" && pathname.startsWith(tab.href));
                                return (
                                    <Link
                                        key={tab.href}
                                        href={tab.href}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                                            isActive
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <tab.icon className="h-4 w-4 shrink-0" />
                                        {tab.title}
                                    </Link>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop: grouped sidebar */}
                    <div className="hidden md:flex flex-col gap-4">
                        {settingsCategories.map((cat) => {
                            const visibleItems = cat.items.filter((tab) => isVisible(tab.visibleTo));
                            if (visibleItems.length === 0) return null;
                            return (
                                <div key={cat.label}>
                                    <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                                        {cat.label}
                                    </p>
                                    <div className="flex flex-col gap-0.5">
                                        {visibleItems.map((tab) => {
                                            const isActive = pathname === tab.href || (tab.href !== "/settings" && pathname.startsWith(tab.href));
                                            return (
                                                <Link
                                                    key={tab.href}
                                                    href={tab.href}
                                                    className={cn(
                                                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                                        isActive
                                                            ? "bg-primary text-primary-foreground"
                                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    )}
                                                >
                                                    <tab.icon className="h-4 w-4 shrink-0" />
                                                    {tab.title}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </nav>

                {/* Settings Content */}
                <div key={pathname} className="flex-1 min-w-0 animate-in fade-in slide-in-from-bottom-3 duration-300 ease-out">
                    {isLoading || !canAccessPath ? null : children}
                </div>
            </div>
        </div>
    );
}
