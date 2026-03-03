"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { RoleGuard } from "@/components/shared/role-guard";

type ConvexPayment = NonNullable<ReturnType<typeof useQuery<typeof api.billing.queries.listPayments>>>[number];
type ConvexPaymentLink = NonNullable<ReturnType<typeof useQuery<typeof api.billing.queries.listPaymentLinks>>>[number];

type PaymentRow = ConvexPayment & { clientName: string; dateDisplay: string };
type LinkRow = ConvexPaymentLink & { clientName: string; expiresDisplay: string; linkUrl: string };

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PaymentsPage() {
    const rawPayments = useQuery(api.billing.queries.listPayments) ?? [];
    const rawLinks = useQuery(api.billing.queries.listPaymentLinks) ?? [];
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const createPaymentLink = useMutation(api.billing.mutations.createPaymentLink);

    const clientMap = useMemo(
        () => new Map(clients.map((c) => [c._id, `${c.firstName} ${c.lastName}`])),
        [clients]
    );

    const payments: PaymentRow[] = rawPayments.map((p) => ({
        ...p,
        clientName: clientMap.get(p.clientId) ?? "—",
        dateDisplay: formatTs(p.paidAt),
    }));

    const paymentLinks: LinkRow[] = rawLinks.map((l) => ({
        ...l,
        clientName: clientMap.get(l.clientId) ?? "—",
        expiresDisplay: formatTs(l.expiresAt),
        linkUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${l.urlToken}`,
    }));

    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkForm, setLinkForm] = useState({
        clientId: "" as Id<"clients"> | "",
        amount: "",
        description: "",
        expiryDate: "",
    });

    const paymentColumns: Column<PaymentRow>[] = [
        {
            key: "reference",
            label: "Reference",
            render: (p) => <span className="font-mono text-sm">{p.reference ?? "—"}</span>,
        },
        { key: "clientName", label: "Client", sortable: true },
        {
            key: "amount",
            label: "Amount",
            sortable: true,
            render: (p) => <span className="font-semibold">${p.amount.toLocaleString()}</span>,
        },
        { key: "method", label: "Method" },
        { key: "dateDisplay", label: "Date", sortable: true },
        { key: "status", label: "Status", render: (p) => <StatusBadge status={p.status} /> },
    ];

    const linkColumns: Column<LinkRow>[] = [
        { key: "clientName", label: "Client", sortable: true },
        { key: "description", label: "Description" },
        {
            key: "amount",
            label: "Amount",
            render: (l) => <span className="font-semibold">${l.amount.toLocaleString()}</span>,
        },
        { key: "expiresDisplay", label: "Expires", sortable: true },
        { key: "status", label: "Status", render: (l) => <StatusBadge status={l.status} /> },
        {
            key: "actions",
            label: "Actions",
            render: (l) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => navigator.clipboard.writeText(l.linkUrl)}
                        title="Copy link"
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => window.open(l.linkUrl, "_blank")}
                        title="Open link"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    const handleCreateLink = async () => {
        if (!linkForm.clientId || !linkForm.amount || !linkForm.description || !linkForm.expiryDate) return;
        setLinkLoading(true);
        try {
            await createPaymentLink({
                clientId: linkForm.clientId as Id<"clients">,
                amount: Number(linkForm.amount),
                description: linkForm.description,
                expiresAt: new Date(linkForm.expiryDate).getTime(),
            });
            setLinkModalOpen(false);
            setLinkForm({ clientId: "", amount: "", description: "", expiryDate: "" });
        } finally {
            setLinkLoading(false);
        }
    };

    return (
        <RoleGuard allowedRoles={["admin"]} redirectTo="/dashboard">
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
                            <Select
                                value={linkForm.clientId}
                                onValueChange={(v) => setLinkForm({ ...linkForm, clientId: v as Id<"clients"> })}
                            >
                                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                <SelectContent>
                                    {clients.map((c) => (
                                        <SelectItem key={c._id} value={c._id}>
                                            {c.firstName} {c.lastName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Amount ($)</Label>
                                <Input
                                    type="number"
                                    value={linkForm.amount}
                                    onChange={(e) => setLinkForm({ ...linkForm, amount: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Expiry Date</Label>
                                <Input
                                    type="date"
                                    value={linkForm.expiryDate}
                                    onChange={(e) => setLinkForm({ ...linkForm, expiryDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Textarea
                                value={linkForm.description}
                                onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
                                placeholder="Payment description..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLinkModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleCreateLink}
                            disabled={
                                linkLoading ||
                                !linkForm.clientId ||
                                !linkForm.amount ||
                                !linkForm.description ||
                                !linkForm.expiryDate
                            }
                        >
                            {linkLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Create Link
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </RoleGuard>
    );
}
