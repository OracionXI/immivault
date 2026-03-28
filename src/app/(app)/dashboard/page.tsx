"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
    Users,
    Briefcase,
    CheckSquare,
    DollarSign,
    Calendar,
    AlertCircle,
    ArrowUpRight,
    Sparkles,
    LayoutTemplate,
    Check,
    ChevronDown,
    Clock,
    Hourglass
} from "lucide-react";
import Link from "next/link";
import { DashboardChart } from "@/components/dashboard/dashboard-chart";
import { BreakdownCharts } from "@/components/dashboard/breakdown-charts";
import { DashboardTaskTable } from "@/components/dashboard/dashboard-task-table";
import { useRole } from "@/hooks/use-role";
import { useCurrency } from "@/hooks/use-currency";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWidgetConfig } from "@/hooks/use-widget-config";
import { CustomizeWidgetsModal } from "@/components/dashboard/customize-widgets-modal";

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function DashboardPage() {
    const { isAdmin, isCaseManager, isAccountant } = useRole();
    const currency = useCurrency();
    const { config, saveConfig, isVisible } = useWidgetConfig();
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
    const [chartTab, setChartTab] = useState("6 M");

    const TAB_ARGS: Record<string, { days?: number; months?: number }> = {
        "1 W":  { days: 7 },
        "1 M":  { days: 30 },
        "6 M":  { months: 6 },
        "1 Y":  { months: 12 },
        "ALL":  { months: 24 },
    };
    const stats = useQuery(api.dashboard.queries.stats);
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];
    const orgSettings = useQuery(api.organisations.queries.getSettings);
    const customRoles = orgSettings?.customRoles ?? [];

    // "Last updated" tag animation — fires once when stats first loads
    type TagPhase = "hidden" | "entering" | "showing" | "collapsing" | "fading" | "gone";
    const [tagPhase, setTagPhase] = useState<TagPhase>("hidden");
    const tagTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const hasTriggered = useRef(false);

    useEffect(() => {
        if (stats === undefined || hasTriggered.current) return;
        hasTriggered.current = true;
        tagTimers.current.forEach(clearTimeout);
        // Mount at zero size first, then animate in on next paint
        setTagPhase("entering");
        const raf = requestAnimationFrame(() => {
            setTagPhase("showing");
            tagTimers.current.push(setTimeout(() => setTagPhase("collapsing"), 1800));
            tagTimers.current.push(setTimeout(() => setTagPhase("fading"), 2300));
            tagTimers.current.push(setTimeout(() => setTagPhase("gone"), 2650));
        });
        return () => { cancelAnimationFrame(raf); tagTimers.current.forEach(clearTimeout); };
    }, [stats]);

    const clientMap = useMemo(
        () => new Map(clients.map((c) => [c._id, `${c.firstName} ${c.lastName}`])),
        [clients]
    );
    const userMap = useMemo(
        () => new Map(users.map((u) => [u._id, u.fullName])),
        [users]
    );

    const t = stats?.trends;
    const allStatCards = [
        { title: "Total Clients", value: stats?.totalClients ?? 0, icon: Users, trend: t?.clients.label ?? "0%", trendUp: t?.clients.up ?? true, period: "vs last week" },
        { title: "Active Cases", value: stats?.activeCases ?? 0, icon: Briefcase, trend: t?.cases.label ?? "0%", trendUp: t?.cases.up ?? true, period: "vs last week" },
        { title: "Completed Tasks", value: stats?.completedTasks ?? 0, icon: CheckSquare, trend: t?.tasks.label ?? "0%", trendUp: t?.tasks.up ?? true, period: "vs last week" },
        { title: "Monthly Revenue", value: formatCurrency(stats?.monthlyRevenue ?? 0, currency), icon: DollarSign, trend: t?.revenue.label ?? "0%", trendUp: t?.revenue.up ?? true, adminOnly: true, period: "vs last month" },
        { title: "Upcoming Appts", value: stats?.upcomingAppointments ?? 0, icon: Calendar, trend: t?.appointments.label ?? "0%", trendUp: t?.appointments.up ?? true, period: "vs last week" },
        { title: "Overdue Invoices", value: stats?.overdueInvoices ?? 0, icon: AlertCircle, trend: t?.overdueInvoices.label ?? "0%", trendUp: !(t?.overdueInvoices.up ?? false), adminOnly: true, period: "vs last week" },
        { title: "Pending Amount", value: formatCurrency(stats?.pendingAmount ?? 0, currency), icon: Hourglass, trend: "—", trendUp: false, adminOnly: true, period: "total outstanding", span2: true },
    ];

    const displayStatCards = allStatCards
        .filter((s) => {
            if ("adminOnly" in s && !isAdmin && !isAccountant) return false;
            if (isAccountant && (s.title === "Active Cases" || s.title === "Completed Tasks")) return false;
            return true;
        })
        .slice(0, isAdmin ? 7 : isAccountant ? 5 : 3);

    const recentCases = stats?.recentCases ?? [];
    const pendingTasksList = stats?.pendingTasksList ?? [];
    const upcomingAppointmentsList = stats?.upcomingAppointmentsList ?? [];
    const recentClients = stats?.recentClients ?? [];

    return (
        <div className="flex flex-col gap-6 pb-6">

            {/* Top Toolbar matching Mockup */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-2">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight mr-4">Dashboard</h1>
                    <Button className="bg-primary text-primary-foreground shadow-sm rounded-lg h-9 px-4 hidden sm:flex">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Ask AI
                    </Button>
                    {isAdmin && !isAccountant && (
                        <Button variant="outline" className="bg-background shadow-sm rounded-lg h-9 px-4 hidden sm:flex" onClick={() => setWidgetModalOpen(true)}>
                            <LayoutTemplate className="h-4 w-4 mr-2 text-muted-foreground" />
                            Customize Widget
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {tagPhase !== "gone" && tagPhase !== "hidden" && (
                        <div
                            style={{
                                maxWidth: tagPhase === "showing" ? 200 : tagPhase === "entering" ? 0 : 28,
                                opacity: tagPhase === "entering" || tagPhase === "fading" ? 0 : 1,
                                paddingLeft: tagPhase === "showing" ? 12 : 6,
                                paddingRight: tagPhase === "showing" ? 12 : 6,
                                transition: "max-width 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease, padding 0.45s cubic-bezier(0.4,0,0.2,1)",
                            }}
                            className="hidden md:flex items-center justify-center overflow-hidden text-xs font-medium text-emerald-600 bg-emerald-50 py-1.5 rounded-full border border-emerald-100"
                        >
                            <Check className="h-3 w-3 shrink-0" />
                            <span
                                style={{
                                    opacity: tagPhase === "showing" ? 1 : 0,
                                    maxWidth: tagPhase === "showing" ? 120 : 0,
                                    marginLeft: tagPhase === "showing" ? 6 : 0,
                                    transition: "opacity 0.2s ease, max-width 0.45s cubic-bezier(0.4,0,0.2,1), margin 0.45s cubic-bezier(0.4,0,0.2,1)",
                                }}
                                className="overflow-hidden whitespace-nowrap"
                            >
                                Last updated now
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left Column (Main Content) */}
                <div className="xl:col-span-2 space-y-6">

                    {/* Stat Cards */}
                    {isVisible("stat_cards") && (
                        <div className={`grid gap-3 md:gap-4 ${isAccountant ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
                            {displayStatCards.map((stat, i) => (
                                <Card key={stat.title} className={`shadow-sm border-border overflow-hidden ${"span2" in stat && stat.span2 ? "col-span-2" : ""}`}>
                                    <CardContent className="p-4 md:p-5">
                                        <div className="flex items-center justify-between mb-3 md:mb-4 gap-2 min-w-0">
                                            <p className="text-xs md:text-sm font-medium text-muted-foreground truncate min-w-0">{stat.title}</p>
                                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center shrink-0 ${stat.trendUp ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {stat.trendUp ? '▲' : '▼'} {stat.trend.replace(/[+-]/, '')}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-xl md:text-2xl font-bold tracking-tight truncate min-w-0">{stat.value}</h3>
                                            <span className="text-[10px] md:text-xs text-muted-foreground truncate">{stat.period}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Non-admin, non-accountant: Task Table (replaces chart) */}
                    {!isAdmin && !isAccountant && (
                        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
                            <div className="p-5 pb-3 border-b border-border">
                                <h3 className="font-semibold text-base">My Tasks</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Active tasks assigned to you</p>
                            </div>
                            <div className="p-1">
                                <DashboardTaskTable />
                            </div>
                        </div>
                    )}

                    {/* Accountant: Revenue chart (same as admin's, no widget toggle needed) */}
                    {isAccountant && (
                        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
                            <div className="p-6 pb-2 flex items-center justify-between">
                                <h3 className="font-semibold text-base flex items-center gap-2">
                                    Total Revenue <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                </h3>
                                <div className="flex items-center gap-1 bg-accent/50 p-1 rounded-lg border border-border/50 text-xs">
                                    {['1 W', '1 M', '6 M', '1 Y', 'ALL'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setChartTab(tab)}
                                            className={`px-2 py-1 rounded-md font-medium transition-colors ${tab === chartTab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="px-6 pb-4">
                                <div className="flex items-baseline gap-2 mb-4">
                                    <h3 className="text-xl font-bold tracking-tight">${stats?.monthlyRevenue?.toLocaleString() ?? "0"}</h3>
                                    <span className={`text-xs font-medium ${t?.revenue.up !== false ? "text-emerald-600" : "text-red-500"}`}>{t?.revenue.label ?? "0%"} vs last month</span>
                                </div>
                            </div>
                            <div className="px-2 pb-2">
                                <DashboardChart isAdmin={true} chartArgs={TAB_ARGS[chartTab] ?? { months: 6 }} currency={currency} />
                            </div>
                        </div>
                    )}

                    {/* Chart Container — admin only (not accountant) */}
                    {isAdmin && !isAccountant && isVisible("revenue_chart") && (
                        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
                            <div className="p-6 pb-2 flex items-center justify-between">
                                <h3 className="font-semibold text-base flex items-center gap-2">
                                    Total Revenue <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                </h3>
                                {/* Chart time tabs */}
                                <div className="flex items-center gap-1 bg-accent/50 p-1 rounded-lg border border-border/50 text-xs">
                                    {['1 W', '1 M', '6 M', '1 Y', 'ALL'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setChartTab(tab)}
                                            className={`px-2 py-1 rounded-md font-medium transition-colors ${tab === chartTab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="px-6 pb-4">
                                <div className="flex items-baseline gap-2 mb-4">
                                    <h3 className="text-xl font-bold tracking-tight">${stats?.monthlyRevenue?.toLocaleString() ?? "0"}</h3>
                                    <span className={`text-xs font-medium ${t?.revenue.up !== false ? "text-emerald-600" : "text-red-500"}`}>{t?.revenue.label ?? "0%"} vs last month</span>
                                </div>
                            </div>
                            <div className="px-2 pb-2">
                                <DashboardChart isAdmin={isAdmin} chartArgs={TAB_ARGS[chartTab] ?? { months: 6 }} currency={currency} />
                            </div>
                        </div>
                    )}

                    {/* Admin: Task Table */}
                    {isAdmin && !isAccountant && isVisible("task_management") && (
                        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
                            <div className="p-5 pb-3 border-b border-border flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-base">Task Management</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">All active tasks across the organisation</p>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span className="text-xs">Pending: <span className="font-semibold text-foreground">{pendingTasksList.length}</span></span>
                                    <span className="text-xs">Completed: <span className="font-semibold text-foreground">{stats?.completedTasks ?? 0}</span></span>
                                </div>
                            </div>
                            <div className="p-1">
                                <DashboardTaskTable />
                            </div>
                        </div>
                    )}

                    {/* Recent Cases Table — admin sees all, case manager sees assigned only */}
                    {(isAdmin || isCaseManager) && !isAccountant && isVisible("recent_cases") && (
                        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
                            <div className="p-5 pb-3 border-b border-border">
                                <h3 className="font-semibold text-base">Recent Cases</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {isAdmin ? "Latest cases opened across the organisation" : "Your recently assigned cases"}
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                {recentCases.length === 0 ? (
                                    <div className="h-32 flex items-center justify-center text-sm text-muted-foreground italic">No cases yet.</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap">Case</th>
                                                <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap hidden md:table-cell">Client</th>
                                                <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap">Status</th>
                                                <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap hidden sm:table-cell">Priority</th>
                                                <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap hidden lg:table-cell">Assigned To</th>
                                                <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap hidden sm:table-cell">Visa Type</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {recentCases.slice(0, 5).map((c) => (
                                                    <tr key={c._id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="py-3 px-3">
                                                            <p className="font-medium text-foreground truncate max-w-[180px] sm:max-w-[240px]">{c.title}</p>
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">{c.caseNumber}</p>
                                                        </td>
                                                        <td className="py-3 px-3 hidden md:table-cell">
                                                            <span className="text-muted-foreground truncate max-w-[140px] block">{clientMap.get(c.clientId) ?? "—"}</span>
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            <StatusBadge status={c.status} />
                                                        </td>
                                                        <td className="py-3 px-3 hidden sm:table-cell">
                                                            <StatusBadge status={c.priority} />
                                                        </td>
                                                        <td className="py-3 px-3 hidden lg:table-cell">
                                                            <span className="text-muted-foreground truncate max-w-[120px] block">
                                                                {c.assignedTo ? (userMap.get(c.assignedTo) ?? "—") : <span className="italic opacity-50">Unassigned</span>}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 hidden sm:table-cell">
                                                            <span className="text-muted-foreground">{c.visaType ?? "—"}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className="px-5 py-4 border-t border-border bg-accent/20">
                                <Button variant="link" asChild className="p-0 h-auto text-xs font-semibold text-primary hover:text-primary/80">
                                    <Link href="/cases">View all cases <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
                                </Button>
                            </div>
                        </div>
                    )}

                    {isAdmin && !isAccountant && (isVisible("case_status") || isVisible("cases_per_client")) && (
                        <BreakdownCharts showCaseStatus={isVisible("case_status")} showCasesPerClient={isVisible("cases_per_client")} />
                    )}

                </div>

                {/* Right Column (Staff List + Calendar / Appointments Widget) */}
                <div className="xl:col-span-1 space-y-6">

                    {/* Staff List Widget */}
                    {(isAdmin || isAccountant) && (isAccountant || isVisible("staff")) && (
                        <Card className="shadow-sm border-border">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base font-semibold">Our Staff</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {users.length === 0 ? (
                                        <p className="text-sm text-muted-foreground p-6 italic text-center">No staff found.</p>
                                    ) : users.slice(0, 5).map((user) => (
                                        <div key={user._id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-xs">
                                                    {user.fullName?.[0]?.toUpperCase() || "U"}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium leading-none mb-1">{user.fullName}</p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {user.roleId && customRoles.find((r) => r.id === user.roleId)?.name
                                                            ? customRoles.find((r) => r.id === user.roleId)!.name
                                                            : user.role === "admin" ? "Admin"
                                                            : user.role === "case_manager" ? "Case Manager"
                                                            : user.role === "accountant" ? "Accountant"
                                                            : "Staff"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex -space-x-1">
                                                {/* Mock activity indicators */}
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-background"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 border-t border-border bg-accent/20 rounded-b-xl text-center">
                                    <Link href="/staff" className="text-xs font-semibold text-primary hover:underline">
                                        Manage Staff
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Calendar Widget */}
                    {(isAccountant || isVisible("calendar")) && <Card className="shadow-sm border-border sticky top-24">
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <CardTitle className="text-base font-semibold">Calendar</CardTitle>
                            <Button variant="outline" size="sm" className="h-8 bg-background">
                                {new Date().toLocaleDateString('en-US', { month: 'short' })}
                                <ChevronDown className="h-3 w-3 ml-2 text-muted-foreground" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Mock Calendar Header */}
                            <div className="px-6 pb-4 border-b border-border">
                                <div className="flex justify-between items-center text-center">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                                        <div key={day} className="flex flex-col gap-2">
                                            <span className="text-[10px] uppercase font-semibold text-muted-foreground">{day}</span>
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${i === new Date().getDay() ? 'bg-primary text-primary-foreground' : ''}`}>
                                                {new Date().getDate() - new Date().getDay() + i}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Schedule List */}
                            <div className="p-6 space-y-6">
                                {upcomingAppointmentsList.length === 0 ? (
                                    <div className="text-center py-6">
                                        <Calendar className="h-8 w-8 text-muted/50 mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground italic">No upcoming appointments.</p>
                                    </div>
                                ) : (
                                    <div className="relative border-l border-border/60 ml-3 space-y-6 pb-2">
                                        {upcomingAppointmentsList.map((a, i) => (
                                            <div key={a._id} className="relative pl-6">
                                                {/* Timeline dot */}
                                                <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20"></div>

                                                <div className="bg-accent/40 rounded-xl p-3 border border-border/50 transition-colors hover:bg-accent">
                                                    <p className="text-sm font-semibold text-card-foreground mb-1 truncate">{a.title}</p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                                                        <Clock className="h-3 w-3" />
                                                        {formatTs(a.startAt)} · {formatTime(a.startAt)} – {formatTime(a.endAt)}
                                                    </p>

                                                    <div className="flex items-center justify-between">
                                                        <div className="flex -space-x-2">
                                                            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center border-2 border-background text-[10px] font-bold text-primary">
                                                                {a.title[0]?.toUpperCase() ?? "A"}
                                                            </div>
                                                            {a.assignedTo && userMap.get(a.assignedTo) && (
                                                                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center border-2 border-background text-[10px] font-bold text-blue-700">
                                                                    {userMap.get(a.assignedTo)![0]}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {a.googleMeetLink ? (
                                                            <a
                                                                href={a.googleMeetLink}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-full px-3 bg-background gap-1">
                                                                    Join Meet <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                                                                </Button>
                                                            </a>
                                                        ) : (
                                                            <Link href="/appointments">
                                                                <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-full px-3 bg-background gap-1">
                                                                    Details <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                                                                </Button>
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-border bg-accent/20 rounded-b-xl">
                                <Button variant="ghost" className="w-full text-xs font-semibold text-primary">
                                    View Full Calendar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>}
                </div>

            </div>

            {isAdmin && !isAccountant && (
                <CustomizeWidgetsModal
                    open={widgetModalOpen}
                    onOpenChange={setWidgetModalOpen}
                    config={config}
                    onApply={saveConfig}
                />
            )}
        </div>
    );
}
