"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { InvoiceModal } from "./invoice-modal";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { RoleGuard } from "@/components/shared/role-guard";

type ConvexInvoice = NonNullable<ReturnType<typeof useQuery<typeof api.billing.queries.listInvoices>>>[number];
type DisplayInvoice = ConvexInvoice & { clientName: string; dueDateDisplay: string };

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function BillingPage() {
    const rawInvoices = useQuery(api.billing.queries.listInvoices) ?? [];
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const removeInvoice = useMutation(api.billing.mutations.removeInvoice);

    const clientMap = useMemo(
        () => new Map(clients.map((c) => [c._id, `${c.firstName} ${c.lastName}`])),
        [clients]
    );

    const invoices = useMemo<DisplayInvoice[]>(
        () => rawInvoices.map((inv) => ({
            ...inv,
            clientName: clientMap.get(inv.clientId) ?? "—",
            dueDateDisplay: formatTs(inv.dueDate),
        })),
        [rawInvoices, clientMap]
    );

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
        { key: "total", label: "Amount", sortable: true, render: (i) => <span className="font-semibold">${i.total.toLocaleString()}</span> },
        { key: "dueDateDisplay", label: "Due", sortable: true },
        { key: "status", label: "Status", render: (i) => <StatusBadge status={i.status} /> },
        {
            key: "actions", label: "Actions", render: (i) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
        <RoleGuard allowedRoles={["admin"]} redirectTo="/dashboard">
        <div className="space-y-6">
            <PageHeader
                title="Billing"
                description="Manage invoices and billing"
                actionLabel="New Invoice"
                onAction={() => { setEditing(null); setModalOpen(true); }}
            />
            <DataTable
                data={invoices as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
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
