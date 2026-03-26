"use client";

import { usePortalSession } from "../layout";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FolderOpen, FileText, Calendar, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function PortalDashboardPage() {
  const session = usePortalSession();
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  if (!session) return null;

  const { client, org, stats } = session;

  const statCards = [
    {
      href: `cases`,
      icon: FolderOpen,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      value: stats.activeCases,
      label: "Active Cases",
      hoverBorder: "hover:border-blue-500/40",
    },
    {
      href: `invoices`,
      icon: FileText,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
      value: stats.pendingInvoiceCount,
      label: "Pending Invoices",
      hoverBorder: "hover:border-amber-500/40",
    },
    {
      href: `invoices`,
      icon: TrendingUp,
      iconBg: "bg-red-500/10",
      iconColor: "text-red-600",
      value: formatCurrency(stats.pendingInvoiceTotal, "USD"),
      label: "Outstanding",
      hoverBorder: "hover:border-red-500/40",
    },
    {
      href: `appointments`,
      icon: Calendar,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      value: stats.upcomingAppointments,
      label: "Upcoming Appointments",
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
            { href: "invoices",     icon: FileText,    label: "View & Pay Invoices"  },
            { href: "appointments", icon: Calendar,    label: "View Appointments"    },
            { href: "cases",        icon: FolderOpen,  label: "Track My Cases"       },
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
    </div>
  );
}
