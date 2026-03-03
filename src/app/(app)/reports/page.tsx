"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useRole } from "@/hooks/use-role";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateClientReport } from "@/lib/pdf-generator";
import { FileDown, DollarSign, Briefcase, Users, TrendingUp } from "lucide-react";

type ConvexClient = NonNullable<ReturnType<typeof useQuery<typeof api.clients.queries.listAll>>>[number];

type ClientReportRow = ConvexClient & {
    fullName: string;
    totalCases: number;
    totalInvoiced: number;
    totalPaid: number;
};

export default function ReportsPage() {
    const { isAdmin } = useRole();
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const cases = useQuery(api.cases.queries.listAll) ?? [];
    const allInvoices = useQuery(api.billing.queries.listInvoices) ?? [];
    const allPayments = useQuery(api.billing.queries.listPayments) ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];

    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [selectedClient, setSelectedClient] = useState("all");

    const userMap = useMemo(
        () => new Map(users.map((u) => [u._id, u.fullName])),
        [users]
    );

    // Scope billing data to visible clients for non-admins.
    // clients/cases are already role-scoped by Convex queries.
    const visibleClientIds = useMemo(() => new Set(clients.map((c) => c._id)), [clients]);
    const invoices = useMemo(
        () => isAdmin ? allInvoices : allInvoices.filter((i) => visibleClientIds.has(i.clientId)),
        [isAdmin, allInvoices, visibleClientIds]
    );
    const payments = useMemo(
        () => isAdmin ? allPayments : allPayments.filter((p) => visibleClientIds.has(p.clientId)),
        [isAdmin, allPayments, visibleClientIds]
    );

    const totalRevenue = payments
        .filter((p) => p.status === "Completed")
        .reduce((s, p) => s + p.amount, 0);

    const totalPending = invoices
        .filter((i) => i.status === "Sent" || i.status === "Overdue")
        .reduce((s, i) => s + i.total, 0);

    const clientReportRows: ClientReportRow[] = useMemo(
        () =>
            clients.map((c) => {
                const clientCases = cases.filter((cs) => cs.clientId === c._id);
                const clientInvoices = invoices.filter((i) => i.clientId === c._id);
                const clientPaid = payments
                    .filter((p) => p.clientId === c._id && p.status === "Completed")
                    .reduce((s, p) => s + p.amount, 0);
                return {
                    ...c,
                    fullName: `${c.firstName} ${c.lastName}`,
                    totalCases: clientCases.length,
                    totalInvoiced: clientInvoices.reduce((s, i) => s + i.total, 0),
                    totalPaid: clientPaid,
                };
            }),
        [clients, cases, invoices, payments]
    );

    const filteredRows =
        selectedClient === "all"
            ? clientReportRows
            : clientReportRows.filter((c) => c._id === selectedClient);

    const columns: Column<ClientReportRow>[] = [
        {
            key: "fullName",
            label: "Client",
            sortable: true,
            render: (c) => <span className="font-medium">{c.fullName}</span>,
        },
        { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
        { key: "totalCases", label: "Cases", sortable: true },
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
                                    assigneeName: userMap.get(cs.assignedTo) ?? "—",
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
                                }))
                        );
                    }}
                >
                    <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Reports" description="Generate reports and analyse your practice" />

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
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-500" /></div><div><p className="text-2xl font-bold">{clients.length}</p><p className="text-xs text-muted-foreground">Total Clients</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-amber-500/10"><Briefcase className="h-5 w-5 text-amber-500" /></div><div><p className="text-2xl font-bold">{cases.length}</p><p className="text-xs text-muted-foreground">Total Cases</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald-500/10"><DollarSign className="h-5 w-5 text-emerald-500" /></div><div><p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Revenue</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-orange-500/10"><TrendingUp className="h-5 w-5 text-orange-500" /></div><div><p className="text-2xl font-bold">${totalPending.toLocaleString()}</p><p className="text-xs text-muted-foreground">Pending</p></div></div></CardContent></Card>
            </div>

            {/* Client Report Table */}
            <DataTable
                data={filteredRows as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                searchKey="fullName"
                searchPlaceholder="Search clients..."
            />
        </div>
    );
}
