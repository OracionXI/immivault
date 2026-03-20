"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useRole } from "@/hooks/use-role";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateClientReport } from "@/lib/pdf-generator";
import { FileDown, DollarSign, Briefcase, Users, TrendingUp, CheckSquare, AlertCircle, Receipt } from "lucide-react";
import { RoleGuard } from "@/components/shared/role-guard";
import { DashboardChart } from "@/components/dashboard/dashboard-chart";
import { BreakdownCharts } from "@/components/dashboard/breakdown-charts";
import { Skeleton } from "@/components/ui/skeleton";

type ConvexClient = NonNullable<ReturnType<typeof useQuery<typeof api.clients.queries.listAll>>>[number];

type ClientReportRow = ConvexClient & {
    fullName: string;
    totalCases: number;
    totalInvoiced: number;
    totalPaid: number;
    contractAmountDisplay: string;
};

export default function ReportsPage() {
    const { isAdmin, isAccountant } = useRole();
    const rawClients  = useQuery(api.clients.queries.listAll);
    const rawCases    = useQuery(api.cases.queries.listAll);
    const rawInvoices = useQuery(api.billing.queries.listInvoices);
    const rawPayments = useQuery(api.billing.queries.listPayments);
    const rawUsers    = useQuery(api.users.queries.listByOrg);
    const org         = useQuery(api.organisations.queries.mine);

    const isLoading = rawClients === undefined || rawCases === undefined;

    const clients     = rawClients  ?? [];
    const cases       = rawCases    ?? [];
    const allInvoices = rawInvoices ?? [];
    const allPayments = rawPayments ?? [];
    const users       = rawUsers    ?? [];

    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [selectedClient, setSelectedClient] = useState("all");

    const userMap = useMemo(
        () => new Map(users.map((u) => [u._id, u.fullName])),
        [users]
    );

    // Scope billing data to visible clients for non-admins
    const visibleClientIds = useMemo(() => new Set(clients.map((c) => c._id)), [clients]);
    const invoices = useMemo(
        () => isAdmin ? allInvoices : allInvoices.filter((i) => visibleClientIds.has(i.clientId)),
        [isAdmin, allInvoices, visibleClientIds]
    );
    const payments = useMemo(
        () => isAdmin ? allPayments : allPayments.filter((p) => visibleClientIds.has(p.clientId)),
        [isAdmin, allPayments, visibleClientIds]
    );

    // ── Summary stats ─────────────────────────────────────────────────────────
    const totalRevenue = payments
        .filter((p) => p.status === "Completed")
        .reduce((s, p) => s + p.amount, 0) / 100;

    const totalPending = invoices.reduce((s, i) => {
        if (i.isContractDraft && i.status !== "Paid") return s + i.total - (i.paidAmount ?? 0);
        if (i.status === "Sent" || i.status === "Overdue") return s + i.total;
        return s;
    }, 0);

    const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
    const overdueCount = invoices.filter((i) => i.status === "Overdue").length;

    // ── Client report rows ────────────────────────────────────────────────────
    const clientReportRows: ClientReportRow[] = useMemo(
        () =>
            clients.map((c) => {
                const clientCases = cases.filter((cs) => cs.clientId === c._id);
                const clientInvoices = invoices.filter((i) => i.clientId === c._id);
                const clientPaid = payments
                    .filter((p) => p.clientId === c._id && p.status === "Completed")
                    .reduce((s, p) => s + p.amount, 0) / 100;
                return {
                    ...c,
                    fullName: `${c.firstName} ${c.lastName}`,
                    totalCases: clientCases.length,
                    totalInvoiced: clientInvoices.filter((i) => !i.isContractDraft).reduce((s, i) => s + i.total, 0),
                    totalPaid: clientPaid,
                    contractAmountDisplay: c.contractAmount
                        ? `$${(c.contractAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "—",
                };
            }),
        [clients, cases, invoices, payments]
    );

    // Apply date + client filters to the client table
    const filteredRows = useMemo(() => {
        const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
        const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : Infinity;
        return clientReportRows.filter((c) => {
            if (selectedClient !== "all" && c._id !== selectedClient) return false;
            if (fromTs > 0 || toTs < Infinity) {
                if (c._creationTime < fromTs || c._creationTime > toTs) return false;
            }
            return true;
        });
    }, [clientReportRows, selectedClient, dateFrom, dateTo]);

    // ── Financial breakdown ───────────────────────────────────────────────────
    const invoiceByStatus = useMemo(() => {
        const map: Record<string, { count: number; total: number }> = {};
        for (const inv of invoices) {
            if (!map[inv.status]) map[inv.status] = { count: 0, total: 0 };
            map[inv.status].count++;
            map[inv.status].total += inv.total;
        }
        return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
    }, [invoices]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border bg-card p-4">
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                                <div className="space-y-1.5 flex-1">
                                    <Skeleton className="h-6 w-16" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="space-y-4">
                    <div className="flex gap-1">
                        {[24, 20, 24].map((w, i) => <Skeleton key={i} className={`h-9 w-${w} rounded-md`} />)}
                    </div>
                    <div className="rounded-xl border bg-card p-5 space-y-3">
                        <Skeleton className="h-5 w-36" />
                        <Skeleton className="h-[260px] w-full rounded-lg" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[0, 1].map((i) => (
                            <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                                <Skeleton className="h-5 w-44" />
                                <Skeleton className="h-[280px] w-full rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const columns: Column<ClientReportRow>[] = [
        {
            key: "fullName",
            label: "Client",
            sortable: true,
            render: (c) => <span className="font-medium">{c.fullName}</span>,
        },
        { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
        { key: "totalCases", label: "Cases", sortable: true },
        { key: "contractAmountDisplay", label: "Contract" },
        { key: "totalInvoiced", label: "Invoiced", render: (c) => `$${c.totalInvoiced.toLocaleString()}` },
        {
            key: "totalPaid",
            label: "Paid",
            render: (c) => (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ${c.totalPaid.toLocaleString()}
                </span>
            ),
        },
        {
            key: "actions",
            label: "Export",
            render: (row) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        generateClientReport(
                            row,
                            cases
                                .filter((cs) => cs.clientId === row._id)
                                .map((cs) => ({
                                    title: cs.title,
                                    visaType: cs.visaType,
                                    status: cs.status,
                                    priority: cs.priority,
                                    caseNumber: cs.caseNumber,
                                    assigneeName: cs.assignedTo ? (userMap.get(cs.assignedTo) ?? "—") : "—",
                                })),
                            invoices
                                .filter((i) => i.clientId === row._id)
                                .map((i) => ({
                                    invoiceNumber: i.invoiceNumber,
                                    total: i.total,
                                    status: i.status,
                                    dueDate: i.dueDate,
                                    issuedAt: i.issuedAt,
                                })),
                            payments
                                .filter((p) => p.clientId === row._id)
                                .map((p) => ({
                                    paidAt: p.paidAt,
                                    amount: p.amount,
                                    method: p.method,
                                    status: p.status,
                                    reference: p.reference,
                                })),
                            org?.name,
                            org?.agreementSignature
                        );
                    }}
                >
                    <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                </Button>
            ),
        },
    ];

    return (
        <RoleGuard allowedRoles={["admin", "case_manager", "accountant"]} redirectTo="/dashboard">
        <div className="space-y-6">
            <PageHeader title="Reports" description="Generate reports and analyse your practice" />

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-500" /></div><div><p className="text-2xl font-bold">{clients.length}</p><p className="text-xs text-muted-foreground">Total Clients</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-amber-500/10"><Briefcase className="h-5 w-5 text-amber-500" /></div><div><p className="text-2xl font-bold">{cases.length}</p><p className="text-xs text-muted-foreground">Total Cases</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald-500/10"><DollarSign className="h-5 w-5 text-emerald-500" /></div><div><p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Revenue</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-orange-500/10"><TrendingUp className="h-5 w-5 text-orange-500" /></div><div><p className="text-2xl font-bold">${totalPending.toLocaleString()}</p><p className="text-xs text-muted-foreground">Pending</p></div></div></CardContent></Card>
            </div>

            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="clients">Clients</TabsTrigger>
                    {(isAdmin || isAccountant) && <TabsTrigger value="financial">Financial</TabsTrigger>}
                </TabsList>

                {/* ── Overview Tab ───────────────────────────────────────── */}
                <TabsContent value="overview" className="space-y-6 mt-4">
                    <Card>
                        <CardHeader className="pb-1">
                            <CardTitle className="text-base font-semibold">Activity Trends</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-2">
                            <DashboardChart isAdmin={isAdmin} />
                        </CardContent>
                    </Card>

                    <BreakdownCharts showCaseStatus showCasesPerClient />
                </TabsContent>

                {/* ── Clients Tab ────────────────────────────────────────── */}
                <TabsContent value="clients" className="space-y-4 mt-4">
                    {/* Filters */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-wrap gap-4 items-end">
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">From</Label>
                                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">To</Label>
                                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="text-xs">Client</Label>
                                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Clients</SelectItem>
                                            {clients.map((c) => (
                                                <SelectItem key={c._id} value={c._id}>
                                                    {c.firstName} {c.lastName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {(dateFrom || dateTo || selectedClient !== "all") && (
                                    <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setSelectedClient("all"); }}>
                                        Clear filters
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <DataTable
                        data={filteredRows as unknown as Record<string, unknown>[]}
                        columns={columns as unknown as Column<Record<string, unknown>>[]}
                        searchKey="fullName"
                        searchPlaceholder="Search clients..."
                    />
                </TabsContent>

                {/* ── Financial Tab (admin + accountant) ─────────────────── */}
                {(isAdmin || isAccountant) && (
                    <TabsContent value="financial" className="space-y-6 mt-4">
                        {/* Financial summary cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10"><Receipt className="h-5 w-5 text-blue-500" /></div><div><p className="text-2xl font-bold">{invoices.length}</p><p className="text-xs text-muted-foreground">Total Invoices</p></div></div></CardContent></Card>
                            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-purple-500/10"><DollarSign className="h-5 w-5 text-purple-500" /></div><div><p className="text-2xl font-bold">${totalInvoiced.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Invoiced</p></div></div></CardContent></Card>
                            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald-500/10"><CheckSquare className="h-5 w-5 text-emerald-500" /></div><div><p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Collected</p></div></div></CardContent></Card>
                            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-red-500/10"><AlertCircle className="h-5 w-5 text-red-500" /></div><div><p className="text-2xl font-bold">{overdueCount}</p><p className="text-xs text-muted-foreground">Overdue Invoices</p></div></div></CardContent></Card>
                        </div>

                        {/* Revenue trend + invoice breakdown side by side */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader className="pb-1">
                                    <CardTitle className="text-base font-semibold">Revenue Trend</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <DashboardChart isAdmin={isAdmin} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-semibold">Invoice Breakdown by Status</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {invoiceByStatus.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-6 text-center italic">No invoices yet.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {invoiceByStatus.map(([status, { count, total }]) => {
                                                const pct = totalInvoiced > 0 ? Math.round((total / totalInvoiced) * 100) : 0;
                                                const barColor =
                                                    status === "Paid"     ? "bg-emerald-500" :
                                                    status === "Overdue"  ? "bg-red-500"     :
                                                    status === "Sent"     ? "bg-amber-500"   :
                                                    status === "Draft"    ? "bg-slate-400"   : "bg-blue-500";
                                                return (
                                                    <div key={status}>
                                                        <div className="flex items-center justify-between text-sm mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`inline-block w-2.5 h-2.5 rounded-full ${barColor}`} />
                                                                <span className="font-medium">{status}</span>
                                                                <span className="text-muted-foreground text-xs">({count})</span>
                                                            </div>
                                                            <span className="font-medium">${total.toLocaleString()}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                )}
            </Tabs>
        </div>
        </RoleGuard>
    );
}
