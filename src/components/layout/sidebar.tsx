"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
    LogOut
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRole } from "@/hooks/use-role";
import { useUser, useClerk } from "@clerk/nextjs";

type Role = "admin" | "case_manager" | "staff" | "accountant";

const navGroups = [
    {
        label: "MAIN",
        items: [
            { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "case_manager", "staff", "accountant"] as Role[] },
            { title: "Clients", href: "/clients", icon: Users, roles: ["admin"] as Role[] },
        ]
    },
    {
        label: "PROJECT",
        items: [
            { title: "Cases", href: "/cases", icon: Briefcase, roles: ["admin", "case_manager", "staff"] as Role[] },
            { title: "Tasks", href: "/tasks", icon: CheckSquare, roles: ["admin", "case_manager", "staff"] as Role[] },
            { title: "Documents", href: "/documents", icon: FileText, roles: ["admin", "case_manager", "staff"] as Role[] },
        ]
    },
    {
        label: "MANAGEMENT",
        items: [
            { title: "Appointments", href: "/appointments", icon: Calendar, roles: ["admin", "case_manager", "staff", "accountant"] as Role[] },
            { title: "Reports", href: "/reports", icon: BarChart3, roles: ["admin", "case_manager"] as Role[] },
            { title: "Billing", href: "/billing", icon: Receipt, roles: ["admin", "accountant"] as Role[] },
            { title: "Payments", href: "/payments", icon: CreditCard, roles: ["admin", "accountant"] as Role[] },
            { title: "Staff", href: "/staff", icon: UserCog, roles: ["admin", "accountant"] as Role[] },
            { title: "Settings", href: "/settings", icon: Settings, roles: ["admin", "case_manager", "staff", "accountant"] as Role[] },
        ]
    }
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const { role } = useRole();
    const { user } = useUser();
    const { signOut } = useClerk();
    const org = useQuery(api.organisations.queries.mine);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const displayName = user?.fullName ?? user?.firstName ?? "User";
    const email = user?.primaryEmailAddress?.emailAddress ?? "";
    const avatarUrl = user?.imageUrl ?? "";
    const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

    const handleSignOut = () => signOut(() => router.push("/login"));

    return (
        <aside
            style={{ willChange: "width" }}
            className={cn(
                "hidden md:flex relative flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out overflow-hidden group",
                collapsed ? "w-[80px]" : "w-[280px]"
            )}
        >
            {/* Header / Logo Area */}
            <div className={cn("h-16 px-4 flex items-center gap-3", collapsed && "justify-center gap-0")}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-transparent font-bold">
                    <Image src="/ordena_logo.png" alt="Ordena Logo" width={40} height={40} className="object-contain" />
                </div>
                <div className={cn(
                    "flex flex-col overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out",
                    collapsed ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100"
                )}>
                    <span className="text-sm font-bold leading-none tracking-tight whitespace-nowrap">Ordena</span>
                    <span className="text-[11px] text-muted-foreground mt-1 whitespace-nowrap">Simply Organized</span>
                </div>
            </div>

            {/* Workspace Selector */}
            <div className={cn(
                "px-4 overflow-hidden transition-[max-height,opacity,padding-bottom] duration-300 ease-in-out",
                collapsed ? "max-h-0 opacity-0 pb-0" : "max-h-20 opacity-100 pb-4"
            )}>
                <div className="w-full flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-[10px] shrink-0">
                            {org?.name?.[0]?.toUpperCase() ?? "O"}
                        </span>
                        <span className="truncate">{org?.name ?? "Loading..."}</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1">
                <nav className="flex flex-col gap-4 p-4 pt-0">
                    {navGroups.map((group) => {
                        const visibleItems = role
                            ? group.items.filter((item) => item.roles.includes(role))
                            : group.items;

                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={group.label} className="flex flex-col gap-1">
                                {!collapsed && (
                                    <div className="flex items-center justify-between px-2 mb-1">
                                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            {group.label}
                                        </h4>
                                    </div>
                                )}
                                {visibleItems.map((item) => {
                                    const isActive =
                                        pathname === item.href ||
                                        (item.href !== "/dashboard" && pathname.startsWith(item.href));

                                    const linkContent = (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                                                isActive
                                                    ? "bg-primary/5 text-primary shadow-sm"
                                                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                                collapsed && "justify-center w-10 h-10 mx-auto p-0 gap-0"
                                            )}
                                        >
                                            <item.icon className="h-4 w-4 shrink-0" />
                                            <span className={cn(
                                                "overflow-hidden whitespace-nowrap transition-all duration-300",
                                                collapsed ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100"
                                            )}>
                                                {item.title}
                                            </span>
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
                            </div>
                        );
                    })}
                </nav>
            </ScrollArea>

            {/* Storage Widget — hidden until Convex Storage is integrated */}

            <Separator />

            {/* User Profile */}
            <div className={cn("p-4", collapsed && "flex justify-center")}>
                {mounted && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-3 w-full hover:bg-accent rounded-lg p-2 -m-2 transition-colors text-left">
                                <Avatar className="h-8 w-8 shrink-0 rounded-full border border-border">
                                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                        {initials || "U"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className={cn(
                                    "flex-1 min-w-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out",
                                    collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
                                )}>
                                    <p className="text-sm font-semibold truncate leading-tight whitespace-nowrap">{displayName}</p>
                                    <p className="text-[11px] text-muted-foreground truncate whitespace-nowrap">{email}</p>
                                </div>
                                <ChevronRight className={cn(
                                    "h-4 w-4 text-muted-foreground shrink-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out",
                                    collapsed ? "max-w-0 opacity-0" : "max-w-[16px] opacity-100"
                                )} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align={collapsed ? "start" : "end"} side={collapsed ? "right" : "top"} forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{displayName}</p>
                                    <p className="text-xs leading-none text-muted-foreground truncate">{email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push("/settings")}>
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                                <LogOut className="mr-2 h-4 w-4" />
                                Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {/* Collapse toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className={cn(
                    "absolute right-0 top-0 z-10",
                    "w-6 h-16",
                    "flex items-center justify-center",
                    "text-muted-foreground hover:bg-accent/50",
                    "opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                )}
            >
                <ChevronLeft className={cn(
                    "h-3.5 w-3.5 transition-transform duration-300",
                    collapsed && "rotate-180"
                )} />
            </button>
        </aside>
    );
}
