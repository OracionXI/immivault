"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockClients, mockCases, mockInvoices, mockPayments } from "@/lib/mock-data";
import { generateClientReport } from "@/lib/pdf-generator";
import { FileDown, DollarSign, Briefcase, Users, TrendingUp } from "lucide-react";

export default function ReportsPage() {
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [selectedClient, setSelectedClient] = useState("all");

    const totalRevenue = mockPayments.filter((p) => p.status === "Completed").reduce((s, p) => s + p.amount, 0);
    const totalPending = mockInvoices.filter((i) => i.status === "Sent" || i.status === "Overdue").reduce((s, i) => s + i.totalAmount, 0);

    const clientReportData = mockClients.map((c) => {
        const cases = mockCases.filter((cs) => cs.clientId === c.id);
        const invoices = mockInvoices.filter((i) => i.clientId === c.id);
        const paid = mockPayments.filter((p) => p.clientId === c.id && p.status === "Completed").reduce((s, p) => s + p.amount, 0);
        return { ...c, totalCases: cases.length, totalInvoiced: invoices.reduce((s, i) => s + i.totalAmount, 0), totalPaid: paid };
    });

    const filteredData = selectedClient === "all" ? clientReportData : clientReportData.filter((c) => c.id === selectedClient);

    const columns: Column<typeof clientReportData[0]>[] = [
        { key: "name", label: "Client", sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
        { key: "visaType", label: "Visa Type" },
        { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
        { key: "totalCases", label: "Cases", sortable: true },
        { key: "totalInvoiced", label: "Invoiced", render: (c) => `$${c.totalInvoiced.toLocaleString()}` },
        { key: "totalPaid", label: "Paid", render: (c) => <span className="text-emerald-600 dark:text-emerald-400 font-medium">${c.totalPaid.toLocaleString()}</span> },
        {
            key: "actions", label: "Export", render: (c) => (
                <Button variant="ghost" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    const client = mockClients.find((cl) => cl.id === c.id)!;
                    generateClientReport(client, mockCases.filter((cs) => cs.clientId === c.id), mockInvoices.filter((i) => i.clientId === c.id), mockPayments.filter((p) => p.clientId === c.id));
                }}>
                    <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Reports" description="Generate reports and analyze your practice" />

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
                                    {mockClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-500" /></div><div><p className="text-2xl font-bold">{mockClients.length}</p><p className="text-xs text-muted-foreground">Total Clients</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-amber-500/10"><Briefcase className="h-5 w-5 text-amber-500" /></div><div><p className="text-2xl font-bold">{mockCases.length}</p><p className="text-xs text-muted-foreground">Total Cases</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald-500/10"><DollarSign className="h-5 w-5 text-emerald-500" /></div><div><p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Revenue</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-orange-500/10"><TrendingUp className="h-5 w-5 text-orange-500" /></div><div><p className="text-2xl font-bold">${totalPending.toLocaleString()}</p><p className="text-xs text-muted-foreground">Pending</p></div></div></CardContent></Card>
            </div>

            {/* Client Report Table */}
            <DataTable
                data={filteredData as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                searchKey="name"
                searchPlaceholder="Search clients..."
            />
        </div>
    );
}
