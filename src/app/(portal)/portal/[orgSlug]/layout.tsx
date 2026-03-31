"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FolderOpen, FileText, CreditCard, Calendar, Bell,
  LogOut, Menu, Sun, Moon, ChevronUp, X, User,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Portal Session Context ───────────────────────────────────────────────────

type PortalSession = {
  client: { firstName: string; lastName: string; email: string };
  org: { name: string; portalSlug?: string; currency: string };
  stats: {
    activeCases: number;
    pendingInvoiceCount: number;
    pendingInvoiceTotal: number;
    upcomingAppointments: number;
  };
  unreadCount: number;
};

type PortalContextValue = PortalSession & { clearUnreadCount: () => void };

const PortalContext = createContext<PortalContextValue | null>(null);
export function usePortalSession() { return useContext(PortalContext); }

// ─── Nav items ────────────────────────────────────────────────────────────────

const navItems = [
  { label: "Dashboard",    href: "dashboard",    icon: LayoutDashboard },
  { label: "My Cases",     href: "cases",         icon: FolderOpen      },
  { label: "Invoices",     href: "invoices",      icon: FileText        },
  { label: "Payments",     href: "payments",      icon: CreditCard      },
  { label: "Appointments", href: "appointments",  icon: Calendar        },
];

// ─── Sidebar (shared) ─────────────────────────────────────────────────────────

function PortalSidebar({
  session,
  orgSlug,
  onClose,
}: {
  session: PortalSession;
  orgSlug: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDark = resolvedTheme === "dark";
  const toggleDark = () => setTheme(isDark ? "light" : "dark");

  const handleLogout = async () => {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.push(`/portal/${orgSlug}`);
  };

  const initials = (session.client.firstName[0] ?? "") + (session.client.lastName[0] ?? "");
  const displayName = `${session.client.firstName} ${session.client.lastName}`;

  return (
    <aside className="flex flex-col h-full w-64 bg-card border-r border-border">

      {/* ── Brand header ───────────────────────────────────────────────────── */}
      <div className="h-16 px-5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Gradient org monogram */}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-black dark:text-white text-sm shadow-sm"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)" }}
          >
            {session.org.name[0]?.toUpperCase() ?? "O"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold leading-none tracking-tight truncate text-black dark:text-white">
              {session.org.name}
            </span>
            <span className="text-[10px] font-medium text-black/50 dark:text-white/50 mt-0.5 tracking-widest uppercase whitespace-nowrap">
              Client Portal
            </span>
          </div>
        </div>
        {onClose && (
          <button className="md:hidden text-muted-foreground hover:text-foreground shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Separator />

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 p-3">

          <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 select-none">
            Navigation
          </p>

          {navItems.map((item) => {
            const href = `/portal/${orgSlug}/${item.href}`;
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={item.href}
                href={href}
                onClick={onClose}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {/* Left active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
                )}
                <item.icon className={cn("h-[15px] w-[15px] shrink-0", isActive && "text-primary")} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Notifications */}
          {(() => {
            const href = `/portal/${orgSlug}/notifications`;
            const isActive = pathname === href;
            return (
              <Link
                href={href}
                onClick={onClose}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
                )}
                <Bell className={cn("h-[15px] w-[15px] shrink-0", isActive && "text-primary")} />
                <span>Notifications</span>
                {session.unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow-sm">
                    {session.unreadCount > 9 ? "9+" : session.unreadCount}
                  </span>
                )}
              </Link>
            );
          })()}
        </nav>
      </ScrollArea>

      <Separator />

      {/* ── User profile ───────────────────────────────────────────────────── */}
      <div className="p-3 shrink-0">
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full hover:bg-accent rounded-xl px-3 py-2.5 transition-colors text-left group">
                <Avatar className="h-8 w-8 shrink-0 rounded-full border border-border shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {initials || "C"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate leading-tight">{displayName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{session.client.email}</p>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" side="top" sideOffset={8} forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{session.client.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/portal/${orgSlug}/profile`)}>
                <User className="mr-2 h-4 w-4" />
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleDark}>
                {isDark
                  ? <><Sun className="mr-2 h-4 w-4" />Light Mode</>
                  : <><Moon className="mr-2 h-4 w-4" />Dark Mode</>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const orgSlug = params.orgSlug as string;

  const [session, setSession] = useState<PortalSession | null>(null);
  const clearUnreadCount = () => setSession((s) => s ? { ...s, unreadCount: 0 } : s);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname === `/portal/${orgSlug}`;
  const isPublicPage =
    pathname === `/portal/${orgSlug}/request` ||
    pathname.startsWith(`/portal/${orgSlug}/pay/`);
  const isShellFree = isLoginPage || isPublicPage || pathname.endsWith("/welcome") || pathname.endsWith("/onboarding");

  useEffect(() => {
    if (isLoginPage || isPublicPage) { setLoading(false); return; }
    fetch("/api/portal/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.client) { router.replace(`/portal/${orgSlug}`); return; }
        setSession(data);
        if (!data.profileCompleted && !isShellFree) {
          router.replace(`/portal/${orgSlug}/welcome`);
        }
      })
      .catch(() => router.replace(`/portal/${orgSlug}`))
      .finally(() => setLoading(false));
  }, [orgSlug, router, isLoginPage, isPublicPage, isShellFree]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isShellFree) return <>{children}</>;
  if (!session) return null;

  return (
    <PortalContext.Provider value={{ ...session, clearUnreadCount }}>
      <div className="min-h-screen flex bg-background">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Desktop sidebar */}
        <div className="hidden md:flex h-screen sticky top-0 shrink-0">
          <PortalSidebar session={session} orgSlug={orgSlug} />
        </div>

        {/* Mobile sidebar (drawer) */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-30 md:hidden transition-transform duration-200 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <PortalSidebar
            session={session}
            orgSlug={orgSlug}
            onClose={() => setSidebarOpen(false)}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Mobile top bar */}
          <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 md:hidden shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-lg text-white text-[10px] font-bold shrink-0 shadow-sm"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)" }}
              >
                {session.org.name[0]?.toUpperCase() ?? "O"}
              </div>
              <p className="font-semibold text-foreground text-sm">{session.org.name}</p>
            </div>
            <div className="w-8" />
          </header>

          <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </PortalContext.Provider>
  );
}
