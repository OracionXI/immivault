"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
    Users,
    Briefcase,
    CheckSquare,
    DollarSign,
    Calendar,
    AlertCircle,
    ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { DashboardChart } from "@/components/dashboard/dashboard-chart";

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardPage() {
    const stats = useQuery(api.dashboard.queries.stats);
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];

    const clientMap = useMemo(
        () => new Map(clients.map((c) => [c._id, `${c.firstName} ${c.lastName}`])),
        [clients]
    );
    const userMap = useMemo(
        () => new Map(users.map((u) => [u._id, u.fullName])),
        [users]
    );

    const statCards = [
        { title: "Total Clients", value: stats?.totalClients ?? 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
        { title: "Active Cases", value: stats?.activeCases ?? 0, icon: Briefcase, color: "text-amber-500", bg: "bg-amber-500/10" },
        { title: "Pending Tasks", value: stats?.pendingTasks ?? 0, icon: CheckSquare, color: "text-violet-500", bg: "bg-violet-500/10" },
        { title: "Monthly Revenue", value: `$${(stats?.monthlyRevenue ?? 0).toLocaleString()}`, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        { title: "Upcoming Appointments", value: stats?.upcomingAppointments ?? 0, icon: Calendar, color: "text-sky-500", bg: "bg-sky-500/10" },
        { title: "Overdue Invoices", value: stats?.overdueInvoices ?? 0, icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
    ];

    const recentCases = stats?.recentCases ?? [];
    const pendingTasksList = stats?.pendingTasksList ?? [];
    const upcomingAppointmentsList = stats?.upcomingAppointmentsList ?? [];
    const recentClients = stats?.recentClients ?? [];

    return (
        <div className="space-y-6">
            <PageHeader title="Dashboard" description="Overview of your immigration practice" />

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {statCards.map((stat) => (
                    <Card key={stat.title} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-2 rounded-lg ${stat.bg}`}>
                                    <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
                                </div>
                            </div>
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{stat.title}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Trends Chart */}
            <DashboardChart />

            {/* Recent Cases + Pending Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-semibold">Recent Cases</CardTitle>
                        <Link href="/cases" className="text-sm text-primary flex items-center gap-1 hover:underline">
                            View all <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {recentCases.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-6 py-4 italic">No cases yet.</p>
                            ) : recentCases.map((c) => (
                                <div key={c._id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{c.title}</p>
                                        <p className="text-xs text-muted-foreground">{clientMap.get(c.clientId) ?? "—"}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <StatusBadge status={c.status} />
                                        <StatusBadge status={c.priority} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-semibold">Pending Tasks</CardTitle>
                        <Link href="/tasks" className="text-sm text-primary flex items-center gap-1 hover:underline">
                            View all <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {pendingTasksList.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-6 py-4 italic">No pending tasks.</p>
                            ) : pendingTasksList.map((t) => (
                                <div key={t._id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{t.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {t.assignedTo ? (userMap.get(t.assignedTo) ?? "—") : "—"}
                                            {t.dueDate ? ` · Due: ${formatTs(t.dueDate)}` : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <StatusBadge status={t.status} />
                                        <StatusBadge status={t.priority} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Upcoming Appointments + Recent Clients */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-semibold">Upcoming Appointments</CardTitle>
                        <Link href="/appointments" className="text-sm text-primary flex items-center gap-1 hover:underline">
                            View all <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {upcomingAppointmentsList.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-6 py-4 italic">No upcoming appointments.</p>
                            ) : upcomingAppointmentsList.map((a) => (
                                <div key={a._id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">{clientMap.get(a.clientId) ?? "—"}</p>
                                        <p className="text-xs text-muted-foreground">{a.type} · {formatTs(a.startAt)}</p>
                                    </div>
                                    <StatusBadge status={a.status} />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-semibold">Recent Clients</CardTitle>
                        <Link href="/clients" className="text-sm text-primary flex items-center gap-1 hover:underline">
                            View all <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {recentClients.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-6 py-4 italic">No clients yet.</p>
                            ) : recentClients.map((client) => (
                                <div key={client._id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">{client.firstName} {client.lastName}</p>
                                        <p className="text-xs text-muted-foreground">{client.email}</p>
                                    </div>
                                    <StatusBadge status={client.status} />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
