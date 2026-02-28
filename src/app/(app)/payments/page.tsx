"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { mockPayments, mockPaymentLinks } from "@/lib/mock-data";
import type { Payment, PaymentLink } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { mockClients } from "@/lib/mock-data";
import { Copy, ExternalLink } from "lucide-react";

export default function PaymentsPage() {
    const [payments] = useState<Payment[]>(mockPayments);
    const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>(mockPaymentLinks);
    const [linkModalOpen, setLinkModalOpen] = useState(false);

    const paymentColumns: Column<Payment>[] = [
        { key: "reference", label: "Reference", render: (p) => <span className="font-mono text-sm">{p.reference}</span> },
        { key: "clientName", label: "Client", sortable: true },
        { key: "amount", label: "Amount", sortable: true, render: (p) => <span className="font-semibold">${p.amount.toLocaleString()}</span> },
        { key: "method", label: "Method" },
        { key: "date", label: "Date", sortable: true },
        { key: "status", label: "Status", render: (p) => <StatusBadge status={p.status} /> },
    ];

    const linkColumns: Column<PaymentLink>[] = [
        { key: "clientName", label: "Client", sortable: true },
        { key: "description", label: "Description" },
        { key: "amount", label: "Amount", render: (l) => <span className="font-semibold">${l.amount.toLocaleString()}</span> },
        { key: "expiryDate", label: "Expires", sortable: true },
        { key: "status", label: "Status", render: (l) => <StatusBadge status={l.status} /> },
        {
            key: "actions", label: "Actions", render: (l) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigator.clipboard.writeText(l.link)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-3.5 w-3.5" /></Button>
                </div>
            ),
        },
    ];

    const [linkForm, setLinkForm] = useState({ clientId: "", amount: "", description: "", expiryDate: "" });

    const handleCreateLink = () => {
        const client = mockClients.find((c) => c.id === linkForm.clientId);
        const newLink: PaymentLink = {
            id: `pl${Date.now()}`, clientId: linkForm.clientId, clientName: client?.name || "",
            amount: Number(linkForm.amount), description: linkForm.description,
            link: `https://pay.immivault.com/pl${Date.now()}`, status: "active",
            expiryDate: linkForm.expiryDate, createdAt: new Date().toISOString().split("T")[0],
        };
        setPaymentLinks((prev) => [...prev, newLink]);
        setLinkModalOpen(false);
        setLinkForm({ clientId: "", amount: "", description: "", expiryDate: "" });
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Payments" description="Track transactions and payment links" />

            <Tabs defaultValue="transactions" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="payment-links">Payment Links</TabsTrigger>
                </TabsList>

                <TabsContent value="transactions">
                    <DataTable
                        data={payments as unknown as Record<string, unknown>[]}
                        columns={paymentColumns as unknown as Column<Record<string, unknown>>[]}
                        searchKey="clientName"
                        searchPlaceholder="Search transactions..."
                        filterDropdown={{
                            key: "status",
                            placeholder: "All Statuses",
                            options: [
                                { label: "Completed", value: "Completed" },
                                { label: "Pending", value: "Pending" },
                                { label: "Failed", value: "Failed" },
                                { label: "Refunded", value: "Refunded" },
                            ],
                        }}
                    />
                </TabsContent>

                <TabsContent value="payment-links">
                    <div className="flex justify-end mb-4">
                        <Button onClick={() => setLinkModalOpen(true)}>Create Payment Link</Button>
                    </div>
                    <DataTable
                        data={paymentLinks as unknown as Record<string, unknown>[]}
                        columns={linkColumns as unknown as Column<Record<string, unknown>>[]}
                        searchKey="clientName"
                        searchPlaceholder="Search payment links..."
                    />
                </TabsContent>
            </Tabs>

            <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader><DialogTitle>Create Payment Link</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Client</Label>
                            <Select value={linkForm.clientId} onValueChange={(v) => setLinkForm({ ...linkForm, clientId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                <SelectContent>{mockClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Amount ($)</Label>
                                <Input type="number" value={linkForm.amount} onChange={(e) => setLinkForm({ ...linkForm, amount: e.target.value })} placeholder="0.00" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Expiry Date</Label>
                                <Input type="date" value={linkForm.expiryDate} onChange={(e) => setLinkForm({ ...linkForm, expiryDate: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Textarea value={linkForm.description} onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })} placeholder="Payment description..." rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLinkModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateLink}>Create Link</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
