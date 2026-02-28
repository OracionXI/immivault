"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mockInvoices } from "@/lib/mock-data";
import type { Invoice } from "@/lib/types";
import { InvoiceModal } from "./invoice-modal";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

export default function BillingPage() {
    const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Invoice | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

    const handleSave = (inv: Invoice) => {
        if (editing) {
            setInvoices((prev) => prev.map((x) => (x.id === inv.id ? inv : x)));
        } else {
            setInvoices((prev) => [...prev, { ...inv, id: `inv${Date.now()}` }]);
        }
        setModalOpen(false);
        setEditing(null);
    };

    const columns: Column<Invoice>[] = [
        { key: "invoiceNumber", label: "Invoice #", sortable: true, render: (i) => <span className="font-medium font-mono">{i.invoiceNumber}</span> },
        { key: "clientName", label: "Client", sortable: true },
        { key: "totalAmount", label: "Amount", sortable: true, render: (i) => <span className="font-semibold">${i.totalAmount.toLocaleString()}</span> },
        { key: "issuedDate", label: "Issued", sortable: true },
        { key: "dueDate", label: "Due", sortable: true },
        { key: "status", label: "Status", render: (i) => <StatusBadge status={i.status} /> },
        {
            key: "actions", label: "Actions", render: (i) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(i); setModalOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, id: i.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Billing" description="Manage invoices and billing" actionLabel="New Invoice" onAction={() => { setEditing(null); setModalOpen(true); }} />
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
            <InvoiceModal open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setEditing(null); }} invoice={editing} onSave={handleSave} />
            <ConfirmDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })} title="Delete Invoice" description="Are you sure you want to delete this invoice?" onConfirm={() => { if (deleteDialog.id) setInvoices((prev) => prev.filter((i) => i.id !== deleteDialog.id)); setDeleteDialog({ open: false, id: null }); }} />
        </div>
    );
}
