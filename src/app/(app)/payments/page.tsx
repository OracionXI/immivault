"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
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
import { Copy, ExternalLink, Loader2, Settings, Pencil, Trash2, FileDown } from "lucide-react";
import { generateAuditReport } from "@/lib/pdf-generator";
import Link from "next/link";
import { RoleGuard } from "@/components/shared/role-guard";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

type ConvexPayment = NonNullable<ReturnType<typeof useQuery<typeof api.billing.queries.listPayments>>>[number];
type ConvexPaymentLink = NonNullable<ReturnType<typeof useQuery<typeof api.billing.queries.listPaymentLinks>>>[number];

type PaymentRow = ConvexPayment & { clientName: string; caseName: string; dateDisplay: string };
type LinkRow = ConvexPaymentLink & { clientName: string; caseName: string; expiresDisplay: string; linkUrl: string };

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PaymentsPage() {
    const rawPayments = useQuery(api.billing.queries.listPayments) ?? [];
    const rawLinks = useQuery(api.billing.queries.listPaymentLinks) ?? [];
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const cases = useQuery(api.cases.queries.listAll) ?? [];
    const org = useQuery(api.organisations.queries.mine);
    const createPaymentLink = useMutation(api.billing.mutations.createPaymentLink);
    const updatePayment = useMutation(api.billing.mutations.updatePayment);
    const removePayment = useMutation(api.billing.mutations.removePayment);
    const updatePaymentLink = useMutation(api.billing.mutations.updatePaymentLink);
    const removePaymentLink = useMutation(api.billing.mutations.removePaymentLink);

    const [editPayment, setEditPayment] = useState<PaymentRow | null>(null);
    const [editForm, setEditForm] = useState({ amount: "", method: "", status: "", reference: "", notes: "", caseId: "" as Id<"cases"> | "" });
    const [editLoading, setEditLoading] = useState(false);
    const [deletePaymentId, setDeletePaymentId] = useState<Id<"payments"> | null>(null);

    const [editLink, setEditLink] = useState<LinkRow | null>(null);
    const [editLinkForm, setEditLinkForm] = useState({ amount: "", description: "", expiryDate: "", status: "", paymentType: "", caseId: "" as Id<"cases"> | "", nextPaymentDate: "" });
    const [editLinkLoading, setEditLinkLoading] = useState(false);
    const [deleteLinkId, setDeleteLinkId] = useState<Id<"paymentLinks"> | null>(null);

    const clientMap = useMemo(
        () => new Map(clients.map((c) => [c._id, `${c.firstName} ${c.lastName}`])),
        [clients]
    );
    const caseMap = useMemo(
        () => new Map(cases.map((c) => [c._id, c.title])),
        [cases]
    );

    const payments: PaymentRow[] = rawPayments.map((p) => ({
        ...p,
        clientName: clientMap.get(p.clientId) ?? "—",
        caseName: p.caseId ? (caseMap.get(p.caseId) ?? "—") : "—",
        dateDisplay: formatTs(p.paidAt),
    }));

    const paymentLinks: LinkRow[] = rawLinks.map((l) => ({
        ...l,
        clientName: clientMap.get(l.clientId) ?? "—",
        caseName: l.caseId ? (caseMap.get(l.caseId) ?? "—") : "—",
        expiresDisplay: formatTs(l.expiresAt),
        linkUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${l.urlToken}`,
    }));

    const [auditModalOpen, setAuditModalOpen] = useState(false);
    const [auditFrom, setAuditFrom] = useState("");
    const [auditTo, setAuditTo] = useState("");

    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkForm, setLinkForm] = useState({
        clientId: "" as Id<"clients"> | "",
        caseId: "" as Id<"cases"> | "",
        amount: "",
        description: "",
        expiryDate: "",
        paymentType: "" as "Full Amount" | "Installment" | "Deposit" | "Partial" | "",
        nextPaymentDate: "",
    });

    const filteredCasesForCreate = useMemo(
        () => cases.filter((c) => c.clientId === linkForm.clientId),
        [cases, linkForm.clientId]
    );
    const filteredCasesForEdit = useMemo(
        () => cases.filter((c) => editLink && c.clientId === editLink.clientId),
        [cases, editLink]
    );
    const filteredCasesForPayment = useMemo(
        () => cases.filter((c) => editPayment && c.clientId === editPayment.clientId),
        [cases, editPayment]
    );

    const handleEditSave = async () => {
        if (!editPayment) return;
        setEditLoading(true);
        try {
            await updatePayment({
                id: editPayment._id,
                amount: Math.round(Number(editForm.amount) * 100),
                method: editForm.method as "Card" | "Bank Transfer" | "Cash" | "Check" | "Online",
                status: editForm.status as "Completed" | "Pending" | "Failed" | "Refunded",
                reference: editForm.reference || undefined,
                notes: editForm.notes || undefined,
                caseId: (editForm.caseId || undefined) as Id<"cases"> | undefined,
            });
            toast.success("Payment updated.");
            setEditPayment(null);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deletePaymentId) return;
        try {
            await removePayment({ id: deletePaymentId });
            toast.success("Payment deleted.");
            setDeletePaymentId(null);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const paymentColumns: Column<PaymentRow>[] = [
        {
            key: "reference",
            label: "Reference",
            render: (p) => <span className="font-mono text-sm">{p.reference ?? "—"}</span>,
        },
        { key: "clientName", label: "Client", sortable: true },
        { key: "caseName", label: "Case" },
        {
            key: "amount",
            label: "Amount",
            sortable: true,
            render: (p) => <span className="font-semibold">${(Number(p.amount) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
        },
        { key: "method", label: "Method" },
        { key: "dateDisplay", label: "Date", sortable: true },
        { key: "status", label: "Status", render: (p) => <StatusBadge status={p.status} /> },
        {
            key: "actions",
            label: "",
            render: (p) => (
                <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => {
                            setEditPayment(p);
                            setEditForm({
                                amount: (Number(p.amount) / 100).toString(),
                                method: p.method ?? "",
                                status: p.status,
                                reference: p.reference ?? "",
                                notes: p.notes ?? "",
                                caseId: (p.caseId ?? "") as Id<"cases"> | "",
                            });
                        }}
                        title="Edit payment"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletePaymentId(p._id)}
                        title="Delete payment"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    const linkColumns: Column<LinkRow>[] = [
        { key: "clientName", label: "Client", sortable: true },
        { key: "caseName", label: "Case" },
        { key: "description", label: "Description" },
        {
            key: "paymentType",
            label: "Type",
            render: (l) => <span>{(l as LinkRow).paymentType ?? "—"}</span>,
        },
        {
            key: "amount",
            label: "Amount",
            render: (l) => <span className="font-semibold">${(Number(l.amount) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
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
                    <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => {
                            setEditLink(l);
                            setEditLinkForm({
                                amount: (Number(l.amount) / 100).toString(),
                                description: l.description,
                                expiryDate: new Date(l.expiresAt).toISOString().split("T")[0],
                                status: l.status,
                                paymentType: l.paymentType ?? "",
                                caseId: (l.caseId ?? "") as Id<"cases"> | "",
                                nextPaymentDate: l.nextPaymentDate
                                    ? new Date(l.nextPaymentDate).toISOString().split("T")[0]
                                    : "",
                            });
                        }}
                        title="Edit link"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteLinkId(l._id)}
                        title="Delete link"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    const handleEditLinkSave = async () => {
        if (!editLink) return;
        setEditLinkLoading(true);
        try {
            await updatePaymentLink({
                id: editLink._id,
                amount: Math.round(Number(editLinkForm.amount) * 100),
                description: editLinkForm.description,
                expiresAt: new Date(editLinkForm.expiryDate).getTime(),
                status: editLinkForm.status as "Active" | "Used" | "Expired",
                paymentType: (editLinkForm.paymentType || undefined) as "Full Amount" | "Installment" | "Deposit" | "Partial" | undefined,
                caseId: (editLinkForm.caseId || undefined) as Id<"cases"> | undefined,
                nextPaymentDate: editLinkForm.nextPaymentDate
                    ? new Date(editLinkForm.nextPaymentDate).getTime()
                    : undefined,
            });
            toast.success("Payment link updated.");
            setEditLink(null);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setEditLinkLoading(false);
        }
    };

    const handleDeleteLink = async () => {
        if (!deleteLinkId) return;
        try {
            await removePaymentLink({ id: deleteLinkId });
            toast.success("Payment link deleted.");
            setDeleteLinkId(null);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleCreateLink = async () => {
        if (!linkForm.clientId || !linkForm.amount || !linkForm.description || !linkForm.expiryDate) return;
        setLinkLoading(true);
        try {
            await createPaymentLink({
                clientId: linkForm.clientId as Id<"clients">,
                caseId: (linkForm.caseId || undefined) as Id<"cases"> | undefined,
                amount: Math.round(Number(linkForm.amount) * 100), // store in cents
                description: linkForm.description,
                expiresAt: new Date(linkForm.expiryDate).getTime(),
                paymentType: linkForm.paymentType || undefined,
                nextPaymentDate: linkForm.nextPaymentDate
                    ? new Date(linkForm.nextPaymentDate).getTime()
                    : undefined,
            });
            setLinkModalOpen(false);
            setLinkForm({ clientId: "", caseId: "", amount: "", description: "", expiryDate: "", paymentType: "", nextPaymentDate: "" });
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setLinkLoading(false);
        }
    };

    return (
        <RoleGuard allowedRoles={["admin", "accountant"]} redirectTo="/dashboard">
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <PageHeader title="Payments" description="Track transactions and payment links" />
                <Link href="/payments/settings">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Settings className="h-4 w-4" />Payment Settings
                    </Button>
                </Link>
            </div>

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
                        headerAction={
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                onClick={() => setAuditModalOpen(true)}
                            >
                                <FileDown className="h-4 w-4" />
                                Audit PDF
                            </Button>
                        }
                    />
                </TabsContent>

                <TabsContent value="payment-links">
                    <DataTable
                        data={paymentLinks as unknown as Record<string, unknown>[]}
                        columns={linkColumns as unknown as Column<Record<string, unknown>>[]}
                        searchKey="clientName"
                        searchPlaceholder="Search payment links..."
                        filterDropdown={{
                            key: "status",
                            placeholder: "All Statuses",
                            options: [
                                { label: "Active", value: "Active" },
                                { label: "Used", value: "Used" },
                                { label: "Expired", value: "Expired" },
                            ],
                        }}
                        headerAction={
                            <Button size="sm" onClick={() => setLinkModalOpen(true)}>Create Payment Link</Button>
                        }
                    />
                </TabsContent>
            </Tabs>

            <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
                <DialogContent style={{ maxWidth: "675px" }}>
                    <DialogHeader><DialogTitle>Create Payment Link</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Client</Label>
                                <Select
                                    value={linkForm.clientId}
                                    onValueChange={(v) => setLinkForm({ ...linkForm, clientId: v as Id<"clients">, caseId: "" })}
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
                            <div className="grid gap-2">
                                <Label>Case (optional)</Label>
                                <Select
                                    value={linkForm.caseId}
                                    onValueChange={(v) => setLinkForm({ ...linkForm, caseId: v as Id<"cases"> })}
                                    disabled={!linkForm.clientId || filteredCasesForCreate.length === 0}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select case" /></SelectTrigger>
                                    <SelectContent>
                                        {filteredCasesForCreate.map((c) => (
                                            <SelectItem key={c._id} value={c._id}>{c.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
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
                        <div className="grid gap-2">
                            <Label>Payment Type</Label>
                            <Select
                                value={linkForm.paymentType}
                                onValueChange={(v) => setLinkForm({ ...linkForm, paymentType: v as typeof linkForm.paymentType, nextPaymentDate: "" })}
                            >
                                <SelectTrigger><SelectValue placeholder="Select type (optional)" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Full Amount">Full Amount</SelectItem>
                                    <SelectItem value="Installment">Installment</SelectItem>
                                    <SelectItem value="Deposit">Deposit</SelectItem>
                                    <SelectItem value="Partial">Partial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {linkForm.paymentType === "Installment" && (
                            <div className="grid gap-2">
                                <Label>Next Payment Date</Label>
                                <Input
                                    type="date"
                                    value={linkForm.nextPaymentDate}
                                    onChange={(e) => setLinkForm({ ...linkForm, nextPaymentDate: e.target.value })}
                                />
                            </div>
                        )}
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
            {/* Edit Payment Dialog */}
            <Dialog open={!!editPayment} onOpenChange={(open) => { if (!open) setEditPayment(null); }}>
                <DialogContent style={{ maxWidth: "675px" }}>
                    <DialogHeader><DialogTitle>Edit Payment</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Amount ($)</Label>
                                <Input
                                    type="number"
                                    value={editForm.amount}
                                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Method</Label>
                                <Select value={editForm.method} onValueChange={(v) => setEditForm({ ...editForm, method: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Card">Card</SelectItem>
                                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="Check">Check</SelectItem>
                                        <SelectItem value="Online">Online</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Failed">Failed</SelectItem>
                                    <SelectItem value="Refunded">Refunded</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Reference</Label>
                            <Input
                                value={editForm.reference}
                                onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                                placeholder="Reference number"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={editForm.notes}
                                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                placeholder="Optional notes..."
                                rows={2}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Case (optional)</Label>
                            <Select
                                value={editForm.caseId}
                                onValueChange={(v) => setEditForm({ ...editForm, caseId: v === "__none__" ? "" : v as Id<"cases"> })}
                                disabled={filteredCasesForPayment.length === 0}
                            >
                                <SelectTrigger><SelectValue placeholder="Select case" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">None</SelectItem>
                                    {filteredCasesForPayment.map((c) => (
                                        <SelectItem key={c._id} value={c._id}>{c.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditPayment(null)}>Cancel</Button>
                        <Button onClick={handleEditSave} disabled={editLoading}>
                            {editLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deletePaymentId}
                onOpenChange={(open) => { if (!open) setDeletePaymentId(null); }}
                title="Delete Payment"
                description="Are you sure you want to delete this payment record? This action cannot be undone."
                confirmText="Delete"
                variant="destructive"
                onConfirm={handleDelete}
            />

            {/* Edit Payment Link Dialog */}
            <Dialog open={!!editLink} onOpenChange={(open) => { if (!open) setEditLink(null); }}>
                <DialogContent style={{ maxWidth: "675px" }}>
                    <DialogHeader><DialogTitle>Edit Payment Link</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Case (optional)</Label>
                            <Select
                                value={editLinkForm.caseId}
                                onValueChange={(v) => setEditLinkForm({ ...editLinkForm, caseId: v as Id<"cases"> })}
                                disabled={filteredCasesForEdit.length === 0}
                            >
                                <SelectTrigger><SelectValue placeholder="Select case" /></SelectTrigger>
                                <SelectContent>
                                    {filteredCasesForEdit.map((c) => (
                                        <SelectItem key={c._id} value={c._id}>{c.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Amount ($)</Label>
                                <Input
                                    type="number"
                                    value={editLinkForm.amount}
                                    onChange={(e) => setEditLinkForm({ ...editLinkForm, amount: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Expiry Date</Label>
                                <Input
                                    type="date"
                                    value={editLinkForm.expiryDate}
                                    onChange={(e) => setEditLinkForm({ ...editLinkForm, expiryDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={editLinkForm.status} onValueChange={(v) => setEditLinkForm({ ...editLinkForm, status: v })}>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Used">Used</SelectItem>
                                    <SelectItem value="Expired">Expired</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Textarea
                                value={editLinkForm.description}
                                onChange={(e) => setEditLinkForm({ ...editLinkForm, description: e.target.value })}
                                placeholder="Payment description..."
                                rows={2}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Payment Type</Label>
                            <Select
                                value={editLinkForm.paymentType}
                                onValueChange={(v) => setEditLinkForm({ ...editLinkForm, paymentType: v, nextPaymentDate: "" })}
                            >
                                <SelectTrigger><SelectValue placeholder="Select type (optional)" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Full Amount">Full Amount</SelectItem>
                                    <SelectItem value="Installment">Installment</SelectItem>
                                    <SelectItem value="Deposit">Deposit</SelectItem>
                                    <SelectItem value="Partial">Partial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {editLinkForm.paymentType === "Installment" && (
                            <div className="grid gap-2">
                                <Label>Next Payment Date</Label>
                                <Input
                                    type="date"
                                    value={editLinkForm.nextPaymentDate}
                                    onChange={(e) => setEditLinkForm({ ...editLinkForm, nextPaymentDate: e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditLink(null)}>Cancel</Button>
                        <Button onClick={handleEditLinkSave} disabled={editLinkLoading}>
                            {editLinkLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteLinkId}
                onOpenChange={(open) => { if (!open) setDeleteLinkId(null); }}
                title="Delete Payment Link"
                description="Are you sure you want to delete this payment link? This action cannot be undone."
                confirmText="Delete"
                variant="destructive"
                onConfirm={handleDeleteLink}
            />
        </div>

            {/* Audit PDF Period Dialog */}
            <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
                <DialogContent style={{ maxWidth: "570px" }}>
                    <DialogHeader><DialogTitle>Download Audit Report</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Select a period to include in the PDF. Leave both blank to include all transactions.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>From Month</Label>
                                <Input
                                    type="month"
                                    value={auditFrom}
                                    onChange={(e) => setAuditFrom(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>To Month</Label>
                                <Input
                                    type="month"
                                    value={auditTo}
                                    onChange={(e) => setAuditTo(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAuditModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                const fromTs = auditFrom ? new Date(auditFrom + "-01").getTime() : null;
                                const toTs = auditTo
                                    ? (() => { const d = new Date(auditTo + "-01"); d.setMonth(d.getMonth() + 1); return d.getTime() - 1; })()
                                    : null;

                                const filtered = payments.filter((p) => {
                                    if (fromTs && p.paidAt < fromTs) return false;
                                    if (toTs && p.paidAt > toTs) return false;
                                    return true;
                                });

                                const fmtMonth = (ym: string) =>
                                    new Date(ym + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" });

                                generateAuditReport(
                                    filtered.map((p) => ({
                                        reference: p.reference,
                                        clientName: p.clientName,
                                        amount: p.amount,
                                        method: p.method,
                                        status: p.status,
                                        dateDisplay: p.dateDisplay,
                                        notes: p.notes,
                                    })),
                                    org?.name,
                                    org?.agreementSignature,
                                    auditFrom ? fmtMonth(auditFrom) : undefined,
                                    auditTo ? fmtMonth(auditTo) : undefined,
                                );
                                setAuditModalOpen(false);
                            }}
                        >
                            <FileDown className="h-4 w-4 mr-2" />
                            Download PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </RoleGuard>
    );
}
