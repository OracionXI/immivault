"use client";

import { useState, useCallback } from "react";
import { usePortalSession } from "../layout";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePolling } from "@/hooks/use-polling";
import {
  FolderOpen, FileText, Calendar, TrendingUp,
  AlertTriangle, Clock, ChevronRight, MapPin, Video, CheckCircle2,
  ArrowRight, Bell, BellOff,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Id } from "@/../convex/_generated/dataModel";

// ─── Types ────────────────────────────────────────────────────────────────────

type OverdueInvoice = {
  _id: Id<"invoices">;
  invoiceNumber: string;
  total: number;
  currency: string;
};

type NextPayment = {
  date: number;
  currency: string;
};

type NextAppointment = {
  _id: Id<"appointments">;
  title: string;
  startAt: number;
  endAt: number;
  type: string;
  modality: string | null;
  status: string;
  caseTitle: string | null;
};

type RecentCase = {
  _id: Id<"cases">;
  title: string;
  status: string;
  caseNumber: string;
  updatedAt: number | null;
  _creationTime: number;
};

type RecentNotification = {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  _creationTime: number;
};

type DashboardDetail = {
  overdueInvoices: OverdueInvoice[];
  nextPayment: NextPayment | null;
  nextAppointment: NextAppointment | null;
  recentCases: RecentCase[];
  recentNotifications: RecentNotification[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit",
  });
}

function daysUntil(ms: number) {
  return Math.ceil((ms - Date.now()) / (1000 * 60 * 60 * 24));
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STATUS_STYLES: Record<string, string> = {
  Active:    "bg-green-500/10 text-green-700 dark:text-green-400",
  Pending:   "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Archive:   "bg-muted text-muted-foreground",
};

const NOTIF_ICON_STYLES: Record<string, { bg: string; color: string }> = {
  case_update:            { bg: "bg-blue-500/10",   color: "text-blue-600" },
  invoice_created:        { bg: "bg-amber-500/10",  color: "text-amber-600" },
  payment_received:       { bg: "bg-green-500/10",  color: "text-green-600" },
  appointment_confirmed:  { bg: "bg-emerald-500/10", color: "text-emerald-600" },
  appointment_cancelled:  { bg: "bg-red-500/10",    color: "text-red-600" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalDashboardPage() {
  const session = usePortalSession();
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const [detail, setDetail] = useState<DashboardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const loadData = useCallback(() => {
    fetch("/api/portal/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setDetail(data);
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, []);

  usePolling(loadData, 15_000);

  if (!session) return null;

  const { client, org, stats } = session;

  const statCards = [
    {
      href: "cases",
      icon: FolderOpen,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      value: stats.activeCases,
      label: "Active Cases",
      hoverBorder: "hover:border-blue-500/40",
    },
    {
      href: "invoices",
      icon: FileText,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
      value: stats.pendingInvoiceCount,
      label: "Pending Invoices",
      hoverBorder: "hover:border-amber-500/40",
    },
    {
      href: "invoices",
      icon: TrendingUp,
      iconBg: "bg-red-500/10",
      iconColor: "text-red-600",
      value: formatCurrency(stats.pendingInvoiceTotal, org.currency),
      label: "Outstanding",
      hoverBorder: "hover:border-red-500/40",
    },
    {
      href: "appointments",
      icon: Calendar,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      value: stats.upcomingAppointments,
      label: "Upcoming Appts",
      hoverBorder: "hover:border-emerald-500/40",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {client.firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here&apos;s an overview of your matters with {org.name}.
        </p>
      </div>

      {/* Overdue invoice alert */}
      {!detailLoading && detail && detail.overdueInvoices.length > 0 && (
        <div
          onClick={() => router.push(`/portal/${orgSlug}/invoices`)}
          className="cursor-pointer flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3.5 hover:bg-red-500/10 transition-colors"
        >
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              {detail.overdueInvoices.length === 1
                ? "You have 1 overdue invoice"
                : `You have ${detail.overdueInvoices.length} overdue invoices`}
            </p>
            <p className="text-xs text-red-500/80 mt-0.5">
              Total overdue:{" "}
              {formatCurrency(
                detail.overdueInvoices.reduce((s, i) => s + i.total, 0),
                detail.overdueInvoices[0].currency
              )}
              {" "}— click to view &amp; pay
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={`/portal/${orgSlug}/${card.href}`}
            className={`bg-card rounded-xl border border-border shadow-sm p-4 hover:shadow-md transition-all ${card.hoverBorder}`}
          >
            <div className={`h-9 w-9 rounded-lg ${card.iconBg} flex items-center justify-center mb-3`}>
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base text-foreground">Quick Actions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Jump to a common task</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { href: "invoices",     icon: FileText,   label: "View & Pay Invoices"  },
            { href: "appointments", icon: Calendar,   label: "View Appointments"    },
            { href: "cases",        icon: FolderOpen, label: "Track My Cases"       },
          ].map((item) => (
            <Link
              key={item.href}
              href={`/portal/${orgSlug}/${item.href}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/40 transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <item.icon className="h-4 w-4 text-primary shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Next Appointment (full width, above the 3-col row) */}
      {!detailLoading && detail?.nextAppointment && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Calendar className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-foreground">{detail.nextAppointment.title}</p>
              {detail.nextAppointment.status === "PendingApproval" && (
                <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 rounded-full px-2 py-0.5">
                  Pending Approval
                </span>
              )}
            </div>
            {detail.nextAppointment.caseTitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{detail.nextAppointment.caseTitle}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(detail.nextAppointment.startAt)}
              {" · "}
              {formatTime(detail.nextAppointment.startAt)}–{formatTime(detail.nextAppointment.endAt)}
              {detail.nextAppointment.modality && (
                <span className="ml-2 inline-flex items-center gap-1">
                  {detail.nextAppointment.modality === "online"
                    ? <><Video className="h-3 w-3" /> Online</>
                    : <><MapPin className="h-3 w-3" /> In-person</>}
                </span>
              )}
            </p>
          </div>
          <Link
            href={`/portal/${orgSlug}/appointments`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline shrink-0"
          >
            View appointments <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Two-column layout: left = Next Payment Due + Recent Cases stacked; right = Notifications */}
      {!detailLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

          {/* Left column: Next Payment Due + Recent Cases stacked */}
          <div className="flex flex-col gap-4">

            {/* Next Payment Due */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-violet-600" />
                </div>
                <p className="font-semibold text-sm text-foreground">Next Payment Due</p>
              </div>
              {detail?.nextPayment ? (
                <>
                  <div>
                    <p className="text-xl font-bold text-foreground">{formatDate(detail.nextPayment.date)}</p>
                    {(() => {
                      const d = daysUntil(detail.nextPayment.date);
                      if (d < 0) return <p className="text-xs text-red-500 font-medium mt-0.5">{Math.abs(d)} day{Math.abs(d) !== 1 ? "s" : ""} overdue</p>;
                      if (d === 0) return <p className="text-xs text-amber-500 font-medium mt-0.5">Due today</p>;
                      if (d <= 7) return <p className="text-xs text-amber-500 font-medium mt-0.5">Due in {d} day{d !== 1 ? "s" : ""}</p>;
                      return <p className="text-xs text-muted-foreground mt-0.5">In {d} days</p>;
                    })()}
                  </div>
                  <Link
                    href={`/portal/${orgSlug}/invoices`}
                    className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    View invoices <ArrowRight className="h-3 w-3" />
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming payment scheduled.</p>
              )}
            </div>

            {/* Recent Cases */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="font-semibold text-sm text-foreground">Recent Cases</p>
                <Link
                  href={`/portal/${orgSlug}/cases`}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {detail?.recentCases && detail.recentCases.length > 0 ? (
                <div className="divide-y divide-border">
                  {detail.recentCases.map((c) => (
                    <Link
                      key={c._id}
                      href={`/portal/${orgSlug}/cases`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
                    >
                      <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <FolderOpen className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{c.title}</p>
                        <p className="text-[11px] text-muted-foreground">#{c.caseNumber}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[c.status] ?? "bg-muted text-muted-foreground"}`}>
                          {c.status}
                        </span>
                        {c.status === "Completed" && <CheckCircle2 className="h-3 w-3 text-blue-500" />}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center p-8">
                  <p className="text-sm text-muted-foreground">No active cases yet.</p>
                </div>
              )}
            </div>

          </div>

          {/* Right column: Notifications (full height) */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-foreground">Notifications</p>
                {session.unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                    {session.unreadCount > 9 ? "9+" : session.unreadCount}
                  </span>
                )}
              </div>
              <Link
                href={`/portal/${orgSlug}/notifications`}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {detail?.recentNotifications && detail.recentNotifications.length > 0 ? (
              <div className="divide-y divide-border">
                {detail.recentNotifications.map((n) => {
                  const style = NOTIF_ICON_STYLES[n.type] ?? { bg: "bg-muted", color: "text-muted-foreground" };
                  return (
                    <Link
                      key={n._id}
                      href={`/portal/${orgSlug}/notifications`}
                      className="flex items-start gap-3 px-4 py-4 hover:bg-accent transition-colors"
                    >
                      <div className={`h-8 w-8 rounded-lg ${style.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Bell className={`h-4 w-4 ${style.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-xs truncate ${n.read ? "font-medium text-foreground" : "font-semibold text-foreground"}`}>
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n._creationTime)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-10 gap-3">
                <BellOff className="h-8 w-8 text-muted-foreground/25" />
                <p className="text-sm text-muted-foreground text-center">No notifications yet.</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
