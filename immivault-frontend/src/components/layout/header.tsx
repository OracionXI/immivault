"use client";

import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Menu, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/shared/notification-bell";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useRole } from "@/hooks/use-role";
import { useUser, useClerk } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

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
} from "lucide-react";

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
            { title: "Settings", href: "/settings", icon: Settings, roles: ["admin", "case_manager", "staff"] as Role[] },
        ]
    }
];

export function Header() {
    const { theme, setTheme } = useTheme();
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { role } = useRole();
    const { user } = useUser();
    const { signOut } = useClerk();

    useEffect(() => {
        setMounted(true);
    }, []);

    const displayName = user?.fullName ?? user?.firstName ?? "User";
    const email = user?.primaryEmailAddress?.emailAddress ?? "";
    const avatarUrl = user?.imageUrl ?? "";
    const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

    const handleSignOut = () => signOut(() => router.push("/login"));

    return (
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-4 border-b border-border bg-card/50 backdrop-blur-xl px-4">
            <div className="flex items-center gap-2 flex-1 md:hidden">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle mobile menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] p-0 flex flex-col" showCloseButton={false}>
                        <SheetTitle className="sr-only">Mobile Navigation</SheetTitle>

                        {/* Sheet header with logo + collapse arrow */}
                        <div className="flex h-16 items-center gap-2.5 px-4 border-b border-border shrink-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-transparent font-bold">
                                <Image src="/ordena_logo.png" alt="Ordena Logo" width={32} height={32} className="object-contain" />
                            </div>
                            <span className="flex-1 text-[15px] font-bold tracking-tight">Ordena</span>
                            <button
                                onClick={() => setOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                aria-label="Close menu"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Nav links */}
                        <div className="flex-1 overflow-y-auto">
                            <nav className="flex flex-col gap-4 p-4 pt-4">
                                {navGroups.map((group) => {
                                    const visibleItems = role
                                        ? group.items.filter((item) => item.roles.includes(role))
                                        : group.items;

                                    if (visibleItems.length === 0) return null;

                                    return (
                                        <div key={group.label} className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between px-2 mb-1">
                                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                    {group.label}
                                                </h4>
                                            </div>
                                            {visibleItems.map((item) => {
                                                const isActive =
                                                    pathname === item.href ||
                                                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        onClick={() => setOpen(false)}
                                                        className={cn(
                                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                                                            isActive
                                                                ? "bg-primary/10 text-primary shadow-sm"
                                                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                                        )}
                                                    >
                                                        <item.icon className="h-4 w-4 shrink-0" />
                                                        <span>{item.title}</span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* User profile section at bottom */}
                        <Separator />
                        <div className="p-4 shrink-0">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-3 w-full rounded-xl bg-accent/50 hover:bg-accent px-3 py-2.5 transition-colors text-left">
                                        <Avatar className="h-9 w-9 shrink-0 rounded-full border border-border">
                                            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                                {initials || "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate leading-tight">{displayName}</p>
                                            <p className="text-[11px] text-muted-foreground truncate">{email}</p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" side="top" forceMount>
                                    <DropdownMenuItem
                                        onClick={handleSignOut}
                                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Log out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            <div className="hidden md:flex flex-1" />

            <div className="flex flex-1 justify-end md:flex-none items-center gap-[6px] md:gap-3">
                {mounted && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="rounded-full h-9 w-9 border border-border bg-background"
                    >
                        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                    </Button>
                )}

                <div className="h-9 w-9 flex items-center justify-center rounded-full border border-border bg-background">
                    <NotificationBell />
                </div>
            </div>
        </header>
    );
}
