"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { InvoiceModal } from "./invoice-modal";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, FileDown } from "lucide-react";
import { RoleGuard } from "@/components/shared/role-guard";
import { useCurrency } from "@/hooks/use-currency";
import { formatCurrency } from "@/lib/utils";
import { generateInvoicePdf } from "@/lib/pdf-generator";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

type ConvexInvoice = NonNullable<ReturnType<typeof useQuery<typeof api.billing.queries.listInvoices>>>[number];
type DisplayInvoice = ConvexInvoice & { clientName: string; caseName: string; dueDateDisplay: string };

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function BillingPage() {
    const currency = useCurrency();
    const convex = useConvex();
    const rawInvoices = useQuery(api.billing.queries.listInvoices) ?? [];
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const cases = useQuery(api.cases.queries.listAll) ?? [];
    const org = useQuery(api.organisations.queries.mine);
    const settings = useQuery(api.organisations.queries.getSettings);
    const removeInvoice = useMutation(api.billing.mutations.removeInvoice);

    const [pdfLoadingId, setPdfLoadingId] = useState<Id<"invoices"> | null>(null);

    const clientMap = useMemo(
        () => new Map(clients.map((c) => [c._id, `${c.firstName} ${c.lastName}`])),
        [clients]
    );
    const caseMap = useMemo(
        () => new Map(cases.map((c) => [c._id, c.title])),
        [cases]
    );

    const invoices = useMemo<DisplayInvoice[]>(
        () => rawInvoices.map((inv) => ({
            ...inv,
            clientName: clientMap.get(inv.clientId) ?? "—",
            caseName: inv.caseId ? (caseMap.get(inv.caseId) ?? "—") : "—",
            dueDateDisplay: inv.isContractDraft ? "Contract" : formatTs(inv.dueDate),
        })),
        [rawInvoices, clientMap, caseMap]
    );

    const handleDownloadPdf = async (invoice: DisplayInvoice) => {
        setPdfLoadingId(invoice._id);
        try {
            const full = await convex.query(api.billing.queries.getInvoice, { id: invoice._id });
            generateInvoicePdf(
                {
                    invoiceNumber: full.invoiceNumber,
                    status: full.status,
                    issuedAt: full.issuedAt,
                    dueDate: full.dueDate,
                    subtotal: full.subtotal,
                    taxRate: full.taxRate,
                    taxAmount: full.taxAmount,
                    total: full.total,
                    notes: full.notes,
                    paidAt: full.paidAt,
                    items: full.items,
                },
                invoice.clientName,
                org?.name ?? "Ordena",
                org?.agreementSignature,
                settings?.defaultCurrency ?? currency
            );
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setPdfLoadingId(null);
        }
    };

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ConvexInvoice | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: Id<"invoices"> | null }>({ open: false, id: null });

    const handleDelete = async () => {
        if (deleteDialog.id) {
            await removeInvoice({ id: deleteDialog.id });
            setDeleteDialog({ open: false, id: null });
        }
    };

    const columns: Column<DisplayInvoice>[] = [
        { key: "invoiceNumber", label: "Invoice #", sortable: true, render: (i) => <span className="font-medium font-mono">{i.invoiceNumber}</span> },
        { key: "clientName", label: "Client", sortable: true },
        { key: "caseName", label: "Case" },
        { key: "total", label: "Amount", sortable: true, render: (i) => (
            <div>
                <span className="font-semibold">{formatCurrency(i.total, currency)}</span>
                {i.isContractDraft && i.paidAmount !== undefined && i.paidAmount > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">({formatCurrency(i.paidAmount, currency)} paid)</span>
                )}
            </div>
        ) },
        { key: "dueDateDisplay", label: "Due", sortable: true },
        { key: "status", label: "Status", render: (i) => <StatusBadge status={i.status} /> },
        {
            key: "actions", label: "Actions", render: (i) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => handleDownloadPdf(i)}
                        disabled={pdfLoadingId === i._id}
                        title="Download Invoice PDF"
                    >
                        <FileDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(i); setModalOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, id: i._id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <RoleGuard allowedRoles={["admin", "accountant"]} redirectTo="/dashboard">
        <div className="space-y-6">
            <PageHeader
                title="Billing"
                description="Manage invoices and billing"
                actionLabel="New Invoice"
                onAction={() => { setEditing(null); setModalOpen(true); }}
            />
            <DataTable<DisplayInvoice>
                data={invoices}
                columns={columns}
                searchKey="clientName"
                searchPlaceholder="Search invoices..."
                filterDropdown={{
                    key: "status",
                    placeholder: "All Statuses",
                    options: [
                        { label: "Draft", value: "Draft" },
                        { label: "Sent", value: "Sent" },
                        { label: "Paid", value: "Paid" },
                        { label: "Overdue", value: "Overdue" },
                    ],
                }}
            />
            <InvoiceModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setEditing(null); }}
                invoice={editing}
            />
            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
                title="Delete Invoice"
                description="Are you sure you want to delete this invoice? This action cannot be undone."
                onConfirm={handleDelete}
            />
        </div>
        </RoleGuard>
    );
}
