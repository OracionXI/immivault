"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ClientModal } from "./client-modal";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

type ConvexClient = NonNullable<ReturnType<typeof useQuery<typeof api.clients.queries.list>>>[number] & { name: string };

export default function ClientsPage() {
    const rawClients = useQuery(api.clients.queries.list) ?? [];
    const removeClient = useMutation(api.clients.mutations.remove);

    // Add computed full name for DataTable search
    const clients = useMemo<ConvexClient[]>(
        () => rawClients.map((c) => ({ ...c, name: `${c.firstName} ${c.lastName}` })),
        [rawClients]
    );

    const [modalOpen, setModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ConvexClient | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; client: ConvexClient | null }>({ open: false, client: null });

    const handleDelete = async () => {
        if (deleteDialog.client) {
            await removeClient({ id: deleteDialog.client._id });
            setDeleteDialog({ open: false, client: null });
        }
    };

    const columns: Column<ConvexClient>[] = [
        { key: "name", label: "Name", sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
        { key: "email", label: "Email", sortable: true },
        { key: "phone", label: "Phone", render: (c) => <span>{c.phone ?? "—"}</span> },
        { key: "nationality", label: "Nationality", sortable: true, render: (c) => <span>{c.nationality ?? "—"}</span> },
        { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
        {
            key: "actions",
            label: "Actions",
            render: (c) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                        { label: "Active", value: "Active" },
                        { label: "Pending", value: "Pending" },
                        { label: "Inactive", value: "Inactive" },
                        { label: "Archived", value: "Archived" },
                    ],
                }}
            />
            <ClientModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingClient(null); }}
                client={editingClient}
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
