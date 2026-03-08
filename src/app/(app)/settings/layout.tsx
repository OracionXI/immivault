"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { User, GitBranch, Layers, Calendar, Building2, Mail, Zap } from "lucide-react";
import { useRole } from "@/hooks/use-role";

const settingsTabs = [
    { title: "Profile",         href: "/settings",                 icon: User,      adminOnly: false },
    { title: "Case Stages",     href: "/settings/case-stages",     icon: GitBranch, adminOnly: true  },
    { title: "Case Types",      href: "/settings/case-types",      icon: Layers,    adminOnly: true  },
    { title: "Booking",         href: "/settings/booking",         icon: Calendar,  adminOnly: true  },
    { title: "Bank Accounts",   href: "/settings/bank-accounts",   icon: Building2, adminOnly: true  },
    { title: "Email Templates", href: "/settings/email-templates", icon: Mail,      adminOnly: true  },
    { title: "Automations",     href: "/settings/automations",     icon: Zap,       adminOnly: true  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAdmin, isLoading } = useRole();

    // Non-admins can only access /settings (Profile). Redirect any deeper path.
    useEffect(() => {
        if (!isLoading && !isAdmin && pathname !== "/settings") {
            router.replace("/settings");
        }
    }, [isAdmin, isLoading, pathname, router]);

    const visibleTabs = settingsTabs.filter((tab) => isAdmin || !tab.adminOnly);

    return (
        <div className="space-y-6">
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

                {/* Settings Content — suppress children on admin-only paths for non-admins */}
                <div className="flex-1 min-w-0">
                    {isLoading || (!isAdmin && pathname !== "/settings") ? null : children}
                </div>
            </div>
        </div>
    );
}
