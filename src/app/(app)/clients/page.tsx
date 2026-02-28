"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mockClients, mockCases, mockInvoices, mockPayments } from "@/lib/mock-data";
import type { Client } from "@/lib/types";
import { ClientModal } from "./client-modal";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, FileDown } from "lucide-react";
import { generateClientReport } from "@/lib/pdf-generator";

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>(mockClients);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });

    const handleSave = (client: Client) => {
        if (editingClient) {
            setClients((prev) => prev.map((c) => (c.id === client.id ? client : c)));
        } else {
            setClients((prev) => [...prev, { ...client, id: `c${Date.now()}` }]);
        }
        setModalOpen(false);
        setEditingClient(null);
    };

    const handleDelete = () => {
        if (deleteDialog.client) {
            setClients((prev) => prev.filter((c) => c.id !== deleteDialog.client!.id));
            setDeleteDialog({ open: false, client: null });
        }
    };

    const handleExportPDF = (client: Client) => {
        const cases = mockCases.filter((c) => c.clientId === client.id);
        const invoices = mockInvoices.filter((i) => i.clientId === client.id);
        const payments = mockPayments.filter((p) => p.clientId === client.id);
        generateClientReport(client, cases, invoices, payments);
    };

    const columns: Column<Client>[] = [
        { key: "name", label: "Name", sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
        { key: "email", label: "Email", sortable: true },
        { key: "phone", label: "Phone" },
        { key: "nationality", label: "Nationality", sortable: true },
        { key: "visaType", label: "Visa Type", sortable: true },
        { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
        {
            key: "actions",
            label: "Actions",
            render: (c) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExportPDF(c)}>
                        <FileDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingClient(c); setModalOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, client: c })}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Clients"
                description="Manage your immigration clients"
                actionLabel="Add Client"
                onAction={() => { setEditingClient(null); setModalOpen(true); }}
            />
            <DataTable
                data={clients as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                searchKey="name"
                searchPlaceholder="Search clients..."
                filterDropdown={{
                    key: "status",
                    placeholder: "All Statuses",
                    options: [
                        { label: "Active", value: "active" },
                        { label: "Pending", value: "pending" },
                        { label: "Inactive", value: "inactive" },
                        { label: "Archived", value: "archived" },
                    ],
                }}
            />
            <ClientModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingClient(null); }}
                client={editingClient}
                onSave={handleSave}
            />
            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, client: deleteDialog.client })}
                title="Delete Client"
                description={`Are you sure you want to delete ${deleteDialog.client?.name}? This action cannot be undone.`}
                onConfirm={handleDelete}
            />
        </div>
    );
}
