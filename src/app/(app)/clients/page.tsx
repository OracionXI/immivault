"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClientModal } from "./client-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2 } from "lucide-react";
import { RoleGuard } from "@/components/shared/role-guard";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

type ConvexClient = NonNullable<ReturnType<typeof useQuery<typeof api.clients.queries.list>>>[number] & { name: string };

export default function ClientsPage() {
    const { isAdmin } = useRole();
    const clientsQuery = useQuery(api.clients.queries.list);
    const rawClients = clientsQuery ?? [];
    const removeClient = useMutation(api.clients.mutations.remove);

    // Add computed full name for DataTable search
    const clients = useMemo<ConvexClient[]>(
        () => rawClients.map((c) => ({ ...c, name: `${c.firstName} ${c.lastName}` })),
        [rawClients]
    );

    const [modalOpen, setModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<ConvexClient | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; client: ConvexClient | null }>({ open: false, client: null });
    const [confirmText, setConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);

    const openDelete = (client: ConvexClient) => {
        setConfirmText("");
        setDeleteDialog({ open: true, client });
    };

    const closeDelete = () => {
        setDeleteDialog({ open: false, client: null });
        setConfirmText("");
    };

    const handleDelete = async () => {
        if (!deleteDialog.client || confirmText !== "CONFIRM") return;
        setDeleting(true);
        try {
            await removeClient({ id: deleteDialog.client._id });
            closeDelete();
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setDeleting(false);
        }
    };

    const columns: Column<ConvexClient>[] = [
        { key: "name", label: "Name", sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
        { key: "email", label: "Email", sortable: true },
        { key: "phone", label: "Phone", render: (c) => <span>{c.phone ?? "—"}</span> },
        { key: "nationality", label: "Nationality", sortable: true, render: (c) => <span>{c.nationality ?? "—"}</span> },
        { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
        ...(isAdmin ? [{
            key: "actions" as const,
            label: "Actions",
            render: (c: ConvexClient) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingClient(c); setModalOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        }] : []),
    ];

    return (
        <RoleGuard allowedRoles={["admin", "accountant"]} redirectTo="/dashboard">
            <div className="space-y-6">
                <PageHeader
                    title="Clients"
                    description="Manage your clients with ease"
                    actionLabel={isAdmin ? "Add Client" : undefined}
                    onAction={isAdmin ? () => { setEditingClient(null); setModalOpen(true); } : undefined}
                />
                <DataTable
                    data={clients as unknown as Record<string, unknown>[]}
                    columns={columns as unknown as Column<Record<string, unknown>>[]}
                    searchKey="name"
                    searchPlaceholder="Search clients..."
                    loading={clientsQuery === undefined}
                    filterDropdown={{
                        key: "status",
                        placeholder: "All Statuses",
                        options: [
                            { label: "Active", value: "Active" },
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

                {/* Destructive delete confirmation — requires typing CONFIRM */}
                <Dialog open={deleteDialog.open} onOpenChange={(open) => { if (!open) closeDelete(); }}>
                    <DialogContent style={{ maxWidth: "660px" }}>
                        <DialogHeader>
                            <DialogTitle>Delete Client</DialogTitle>
                            <DialogDescription className="pt-1">
                                This will permanently delete{" "}
                                <span className="font-semibold text-foreground">{deleteDialog.client?.name}</span>{" "}
                                along with all associated cases, tasks, and documents. This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-3 py-2">
                            <p className="text-sm text-muted-foreground">
                                Type <span className="font-mono font-semibold text-destructive">CONFIRM</span> to proceed.
                            </p>
                            <Input
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="CONFIRM"
                                onKeyDown={(e) => { if (e.key === "Enter" && confirmText === "CONFIRM") handleDelete(); }}
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={closeDelete} disabled={deleting}>Cancel</Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={confirmText !== "CONFIRM" || deleting}
                            >
                                {deleting ? "Deleting…" : "Delete Permanently"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </RoleGuard>
    );
}
