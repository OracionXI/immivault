"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FolderOpen, FileText, CreditCard, Calendar, Bell, LogOut, Menu, X, Sun, Moon,
} from "lucide-react";

// ─── Portal Session Context ───────────────────────────────────────────────────

type PortalSession = {
  client: { firstName: string; lastName: string; email: string };
  org: { name: string; portalSlug?: string };
  stats: {
    activeCases: number;
    pendingInvoiceCount: number;
    pendingInvoiceTotal: number;
    upcomingAppointments: number;
  };
  unreadCount: number;
};

const PortalContext = createContext<PortalSession | null>(null);
export function usePortalSession() { return useContext(PortalContext); }

// ─── Nav items ────────────────────────────────────────────────────────────────

const navItems = [
  { label: "Dashboard",    href: "dashboard",    icon: LayoutDashboard },
  { label: "My Cases",     href: "cases",         icon: FolderOpen      },
  { label: "Invoices",     href: "invoices",      icon: FileText        },
  { label: "Payments",     href: "payments",      icon: CreditCard      },
  { label: "Appointments", href: "appointments",  icon: Calendar        },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const orgSlug = params.orgSlug as string;

  const { setTheme, resolvedTheme } = useTheme();
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Login page is public — no session needed, no sidebar shell
  const isLoginPage = pathname === `/portal/${orgSlug}`;
  // Welcome and onboarding bypass the profile gate and don't need the sidebar shell
  const isShellFree = isLoginPage || pathname.endsWith("/welcome") || pathname.endsWith("/onboarding");

  const isDark = resolvedTheme === "dark";
  const toggleDark = () => setTheme(isDark ? "light" : "dark");

  useEffect(() => {
    if (isLoginPage) { setLoading(false); return; }
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
  }, [orgSlug, router, isLoginPage, isShellFree]);

  const handleLogout = async () => {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.push(`/portal/${orgSlug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Login, welcome, and onboarding render as standalone full-page experiences (no sidebar)
  if (isShellFree) return <>{children}</>;

  if (!session) return null;

  return (
    <PortalContext.Provider value={session}>
      <div className="min-h-screen flex">
        <div className="min-h-screen bg-background flex w-full">
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-20 bg-black/40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-30 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 md:relative md:translate-x-0",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            {/* Logo / org name */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-border">
              <div>
                <p className="font-bold text-foreground text-sm leading-tight">{session.org.name}</p>
                <p className="text-xs text-muted-foreground">Client Portal</p>
              </div>
              <button className="md:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Client info */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-primary">
                    {session.client.firstName[0]}{session.client.lastName[0]}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {session.client.firstName} {session.client.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{session.client.email}</p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-0.5">
              {navItems.map((item) => {
                const href = `/portal/${orgSlug}/${item.href}`;
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={item.href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                      isActive
                        ? "bg-primary/5 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}

              {/* Notifications */}
              <Link
                href={`/portal/${orgSlug}/notifications`}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                  pathname === `/portal/${orgSlug}/notifications`
                    ? "bg-primary/5 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Bell className="h-4 w-4 shrink-0" />
                Notifications
                {session.unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] rounded-full h-4.5 w-4.5 min-w-[18px] flex items-center justify-center font-bold px-1">
                    {session.unreadCount > 9 ? "9+" : session.unreadCount}
                  </span>
                )}
              </Link>
            </nav>

            {/* Bottom: theme toggle + logout */}
            <div className="p-3 border-t border-border space-y-0.5">
              <button
                onClick={toggleDark}
                className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
              >
                {isDark
                  ? <><Sun className="h-4 w-4" />Light Mode</>
                  : <><Moon className="h-4 w-4" />Dark Mode</>}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-600 transition-all duration-150"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar (mobile) */}
            <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 md:hidden">
              <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
                <Menu className="h-5 w-5" />
              </button>
              <p className="font-semibold text-foreground text-sm">{session.org.name}</p>
              <div className="w-8" />
            </header>

            <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </div>
    </PortalContext.Provider>
  );
}
