"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { User, GitBranch, Calendar, Building2, Mail, Zap } from "lucide-react";

const settingsTabs = [
    { title: "Profile", href: "/settings", icon: User },
    { title: "Case Stages", href: "/settings/case-stages", icon: GitBranch },
    { title: "Booking", href: "/settings/booking", icon: Calendar },
    { title: "Bank Accounts", href: "/settings/bank-accounts", icon: Building2 },
    { title: "Email Templates", href: "/settings/email-templates", icon: Mail },
    { title: "Automations", href: "/settings/automations", icon: Zap },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your application configuration</p>
            </div>

            <div className="flex gap-6">
                {/* Settings Sidebar */}
                <nav className="w-56 shrink-0 space-y-1">
                    {settingsTabs.map((tab) => {
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
                                <tab.icon className="h-4 w-4" />
                                {tab.title}
                            </Link>
                        );
                    })}
                </nav>

                {/* Settings Content */}
                <div className="flex-1 min-w-0">{children}</div>
            </div>
        </div>
    );
}
