"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    Briefcase,
    CheckSquare,
    FileText,
    Calendar,
    Receipt,
    CreditCard,
    BarChart3,
    UserCog,
    Settings,
    ChevronLeft,
    ChevronRight,
    Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import { useRole } from "@/hooks/use-role";

type Role = "admin" | "case_manager" | "staff";

const navItems = [
    { title: "Dashboard",    href: "/dashboard",    icon: LayoutDashboard, roles: ["admin", "case_manager", "staff"] as Role[] },
    { title: "Clients",      href: "/clients",      icon: Users,           roles: ["admin"] as Role[] },
    { title: "Cases",        href: "/cases",        icon: Briefcase,       roles: ["admin", "case_manager", "staff"] as Role[] },
    { title: "Tasks",        href: "/tasks",        icon: CheckSquare,     roles: ["admin", "case_manager", "staff"] as Role[] },
    { title: "Documents",    href: "/documents",    icon: FileText,        roles: ["admin", "case_manager", "staff"] as Role[] },
    { title: "Appointments", href: "/appointments", icon: Calendar,        roles: ["admin", "case_manager", "staff"] as Role[] },
    { title: "Billing",      href: "/billing",      icon: Receipt,         roles: ["admin"] as Role[] },
    { title: "Payments",     href: "/payments",     icon: CreditCard,      roles: ["admin"] as Role[] },
    { title: "Reports",      href: "/reports",      icon: BarChart3,       roles: ["admin", "case_manager"] as Role[] },
    { title: "Staff",        href: "/staff",        icon: UserCog,         roles: ["admin"] as Role[] },
    { title: "Settings",     href: "/settings",     icon: Settings,        roles: ["admin", "case_manager", "staff"] as Role[] },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const { role } = useRole();

    const visibleItems = role
        ? navItems.filter((item) => item.roles.includes(role))
        : navItems; // show all while loading to avoid flash

    return (
        <aside
            className={cn(
                "hidden md:flex relative flex-col border-r border-border bg-card transition-all duration-300 ease-in-out",
                collapsed ? "w-[68px]" : "w-[260px]"
            )}
        >
            {/* Logo */}
            <div className="flex h-16 items-center gap-2 px-4 border-b border-border">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                    <Shield className="h-5 w-5" />
                </div>
                {!collapsed && (
                    <span className="text-lg font-bold tracking-tight">
                        ImmiVault
                    </span>
                )}
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1 py-2">
                <nav className="flex flex-col gap-1 px-2">
                    {visibleItems.map((item) => {
                        const isActive =
                            pathname === item.href ||
                            (item.href !== "/dashboard" && pathname.startsWith(item.href));

                        const linkContent = (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                    "hover:bg-accent hover:text-accent-foreground",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                                        : "text-muted-foreground",
                                    collapsed && "justify-center px-2"
                                )}
                            >
                                <item.icon className={cn("h-4.5 w-4.5 shrink-0", collapsed && "h-5 w-5")} />
                                {!collapsed && <span>{item.title}</span>}
                            </Link>
                        );

                        if (collapsed) {
                            return (
                                <Tooltip key={item.href} delayDuration={0}>
                                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                                    <TooltipContent side="right" className="font-medium">
                                        {item.title}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        }

                        return linkContent;
                    })}
                </nav>
            </ScrollArea>

            <Separator />

            {/* Collapse toggle */}
            <div className="p-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn("w-full", collapsed && "px-0")}
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <>
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            <span>Collapse</span>
                        </>
                    )}
                </Button>
            </div>
        </aside>
    );
}
