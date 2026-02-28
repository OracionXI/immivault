"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { dashboardStats, mockCases, mockTasks, mockAppointments, mockClients } from "@/lib/mock-data";
import {
    Users,
    Briefcase,
    CheckSquare,
    DollarSign,
    Calendar,
    AlertCircle,
    ArrowUpRight,
    TrendingUp,
} from "lucide-react";
import Link from "next/link";

const statCards = [
    { title: "Total Clients", value: dashboardStats.totalClients, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", trend: "+12%" },
    { title: "Active Cases", value: dashboardStats.activeCases, icon: Briefcase, color: "text-amber-500", bg: "bg-amber-500/10", trend: "+5%" },
    { title: "Pending Tasks", value: dashboardStats.pendingTasks, icon: CheckSquare, color: "text-violet-500", bg: "bg-violet-500/10", trend: "-3%" },
    { title: "Monthly Revenue", value: `$${dashboardStats.monthlyRevenue.toLocaleString()}`, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10", trend: "+18%" },
    { title: "Upcoming Appointments", value: dashboardStats.upcomingAppointments, icon: Calendar, color: "text-sky-500", bg: "bg-sky-500/10", trend: "+2" },
    { title: "Overdue Invoices", value: dashboardStats.overdueInvoices, icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", trend: "1" },
];

export default function DashboardPage() {
    const recentCases = mockCases.slice(0, 5);
    const pendingTasks = mockTasks.filter((t) => t.status !== "Done").slice(0, 5);
    const upcoming = mockAppointments.filter((a) => a.status === "active").slice(0, 3);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Dashboard"
                description="Overview of your immigration practice"
            />

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {statCards.map((stat) => (
                    <Card key={stat.title} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-2 rounded-lg ${stat.bg}`}>
                                    <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
                                </div>
                                <div className="flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                                    <TrendingUp className="h-3 w-3" />
                                    {stat.trend}
                                </div>
                            </div>
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{stat.title}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Cases + Pending Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Cases */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-semibold">Recent Cases</CardTitle>
                        <Link
                            href="/cases"
                            className="text-sm text-primary flex items-center gap-1 hover:underline"
                        >
                            View all <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {recentCases.map((c) => (
                                <div
                                    key={c.id}
                                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{c.title}</p>
                                        <p className="text-xs text-muted-foreground">{c.clientName}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <StatusBadge status={c.stage} />
                                        <StatusBadge status={c.priority} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Pending Tasks */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-semibold">Pending Tasks</CardTitle>
                        <Link
                            href="/tasks"
                            className="text-sm text-primary flex items-center gap-1 hover:underline"
                        >
                            View all <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {pendingTasks.map((t) => (
                                <div
                                    key={t.id}
                                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{t.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {t.assignee} · Due: {t.dueDate}
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

            {/* Upcoming Appointments + Client Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Appointments */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-semibold">Upcoming Appointments</CardTitle>
                        <Link
                            href="/appointments"
                            className="text-sm text-primary flex items-center gap-1 hover:underline"
                        >
                            View all <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {upcoming.map((a) => (
                                <div
                                    key={a.id}
                                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">{a.clientName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {a.type} · {a.date} at {a.time}
                                        </p>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {a.location}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Clients */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-semibold">Recent Clients</CardTitle>
                        <Link
                            href="/clients"
                            className="text-sm text-primary flex items-center gap-1 hover:underline"
                        >
                            View all <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {mockClients.slice(0, 5).map((client) => (
                                <div
                                    key={client.id}
                                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">{client.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {client.email} · {client.visaType}
                                        </p>
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
