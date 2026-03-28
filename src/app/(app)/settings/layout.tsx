"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { User, GitBranch, Layers, Building2, FileText, Shield, CalendarClock, CreditCard, Globe, DollarSign } from "lucide-react";
import { useRole } from "@/hooks/use-role";

// visibleTo: "all" | "admin" | "admin_cm" (admin + case_manager)
const settingsTabs = [
    { title: "Profile",         href: "/settings",                    icon: User,          visibleTo: "all"      },
    { title: "My Availability", href: "/settings/my-availability",    icon: CalendarClock, visibleTo: "admin_cm" },
    { title: "Case Stages",     href: "/settings/case-stages",        icon: GitBranch,     visibleTo: "admin"    },
    { title: "Case Types",      href: "/settings/case-types",         icon: Layers,        visibleTo: "admin"    },
    { title: "Doc Types",       href: "/settings/doc-types",          icon: FileText,      visibleTo: "admin"    },
    { title: "Role Types",      href: "/settings/role-types",         icon: Shield,        visibleTo: "admin"    },
    { title: "Bank Accounts",   href: "/settings/bank-accounts",      icon: Building2,     visibleTo: "admin"    },
    { title: "Appt Types",      href: "/settings/appointment-types",  icon: CalendarClock, visibleTo: "admin"    },
    { title: "Payments",        href: "/payments/settings",           icon: CreditCard,    visibleTo: "admin"    },
    { title: "Client Portal",   href: "/settings/portal",             icon: Globe,         visibleTo: "admin"    },
    { title: "Appt Pricing",    href: "/settings/appointment-pricing",icon: DollarSign,    visibleTo: "admin"    },
] as const;

// Paths accessible to case managers (in addition to /settings)
const CM_ALLOWED_PATHS = ["/settings/my-availability"];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAdmin, isCaseManager, isLoading } = useRole();

    const canAccessPath = isAdmin || pathname === "/settings" || (isCaseManager && CM_ALLOWED_PATHS.some((p) => pathname.startsWith(p)));

    // Redirect unauthorised access
    useEffect(() => {
        if (!isLoading && !canAccessPath) {
            router.replace("/settings");
        }
    }, [isLoading, canAccessPath, router]);

    const visibleTabs = settingsTabs.filter((tab) => {
        if (tab.visibleTo === "all") return true;
        if (tab.visibleTo === "admin") return isAdmin;
        if (tab.visibleTo === "admin_cm") return isAdmin || isCaseManager;
        return false;
    });

    return (
        <div className="space-y-6 pb-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your application configuration</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Settings Sidebar */}
                <nav className="flex md:flex-col w-full md:w-56 shrink-0 gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                    {visibleTabs.map((tab) => {
                        const isActive = pathname === tab.href || (tab.href !== "/settings" && pathname.startsWith(tab.href));
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={cn(
                                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
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
                </nav>

                {/* Settings Content */}
                <div key={pathname} className="flex-1 min-w-0 animate-in fade-in slide-in-from-bottom-3 duration-300 ease-out">
                    {isLoading || !canAccessPath ? null : children}
                </div>
            </div>
        </div>
    );
}
