"use client";

import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sun, Moon, Menu, Shield, LayoutDashboard, Users, Briefcase, CheckSquare, FileText, Calendar, Receipt, CreditCard, BarChart3, UserCog, Settings } from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";
import { NotificationBell } from "@/components/shared/notification-bell";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useRole } from "@/hooks/use-role";

type Role = "admin" | "case_manager" | "staff";

const navItems = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "case_manager", "staff"] as Role[] },
    { title: "Clients", href: "/clients", icon: Users, roles: ["admin"] as Role[] },
    { title: "Cases", href: "/cases", icon: Briefcase, roles: ["admin", "case_manager"] as Role[] },
    { title: "Tasks", href: "/tasks", icon: CheckSquare, roles: ["admin", "case_manager", "staff"] as Role[] },
    { title: "Documents", href: "/documents", icon: FileText, roles: ["admin", "case_manager"] as Role[] },
    { title: "Appointments", href: "/appointments", icon: Calendar, roles: ["admin", "case_manager"] as Role[] },
    { title: "Billing", href: "/billing", icon: Receipt, roles: ["admin"] as Role[] },
    { title: "Payments", href: "/payments", icon: CreditCard, roles: ["admin"] as Role[] },
    { title: "Reports", href: "/reports", icon: BarChart3, roles: ["admin"] as Role[] },
    { title: "Staff", href: "/staff", icon: UserCog, roles: ["admin"] as Role[] },
    { title: "Settings", href: "/settings", icon: Settings, roles: ["admin"] as Role[] },
];

export function Header() {
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useUser();
    const { signOut } = useClerk();
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { role } = useRole();

    useEffect(() => {
        setMounted(true);
    }, []);

    const displayName = user?.fullName ?? user?.firstName ?? "User";
    const email = user?.primaryEmailAddress?.emailAddress ?? "";
    const avatarUrl = user?.imageUrl ?? "";
    const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

    const handleSignOut = () => signOut(() => router.push("/login"));

    const visibleItems = role
        ? navItems.filter((item) => item.roles.includes(role))
        : navItems;

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/80 backdrop-blur-md px-4 md:px-6">
            <div className="flex items-center gap-2 flex-1 md:flex-none">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Toggle mobile menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[260px] p-0">
                        <SheetTitle className="sr-only">Mobile Navigation</SheetTitle>
                        <div className="flex h-16 items-center gap-2 px-4 border-b border-border">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                                <Shield className="h-5 w-5" />
                            </div>
                            <span className="text-lg font-bold tracking-tight">ImmiVault</span>
                        </div>
                        <nav className="flex flex-col gap-1 px-2 py-4">
                            {visibleItems.map((item) => {
                                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                            "hover:bg-accent hover:text-accent-foreground",
                                            isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                                        )}
                                    >
                                        <item.icon className="h-4.5 w-4.5 shrink-0" />
                                        <span>{item.title}</span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </SheetContent>
                </Sheet>
            </div>

            <div className="flex items-center gap-[6px] md:gap-2">
                {mounted && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="rounded-full"
                    >
                        <Sun className="h-4.5 w-4.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4.5 w-4.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                    </Button>
                )}

                <NotificationBell />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-9 w-9 rounded-full ml-1">
                            <Avatar className="h-9 w-9">
                                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                                    {initials || "U"}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{displayName}</p>
                                <p className="text-xs leading-none text-muted-foreground truncate">{email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push("/settings")}>Settings</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
