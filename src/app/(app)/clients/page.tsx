"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageTitle } from "@/components/shared/page-title";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClientModal } from "./client-modal";
import { ProspectReviewModal, type ProspectRequest } from "./prospect-review-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Eye, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { RoleGuard } from "@/components/shared/role-guard";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

type ConvexClient = NonNullable<ReturnType<typeof useQuery<typeof api.clients.queries.list>>>[number] & { name: string };

// Format "HH:MM" → "9:00 AM"
function fmtTime(t: string) {
    const [h, m] = t.split(":").map(Number);
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export default function ClientsPage() {
    const { isAdmin } = useRole();
    const clientsQuery = useQuery(api.clients.queries.list);
    const rawClients = clientsQuery ?? [];
    const removeClient = useMutation(api.clients.mutations.remove);
    const removeProspect = useMutation(api.appointmentRequests.mutations.remove);

    // Prospects — admin only
    const prospectsQuery = useQuery(
        isAdmin ? api.appointmentRequests.queries.list : api.appointmentRequests.queries.list,
        isAdmin ? {} : "skip" as unknown as Record<string, never>
    );
    const allProspects = (prospectsQuery ?? []) as ProspectRequest[];
    const pendingCount = allProspects.filter((p) => p.status === "pending").length;

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

    // Prospect review
    const [reviewRequest, setReviewRequest] = useState<ProspectRequest | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);

    // Prospect delete
    const [prospectDeleteDialog, setProspectDeleteDialog] = useState<{ open: boolean; prospect: ProspectRequest | null }>({ open: false, prospect: null });
    const [prospectDeleting, setProspectDeleting] = useState(false);

    // Copy portal URL
    const [copied, setCopied] = useState(false);

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

    const handleProspectDelete = async () => {
        if (!prospectDeleteDialog.prospect) return;
        setProspectDeleting(true);
        try {
            await removeProspect({ requestId: prospectDeleteDialog.prospect._id });
            setProspectDeleteDialog({ open: false, prospect: null });
            toast.success("Prospect deleted.");
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setProspectDeleting(false);
        }
    };

    const openReview = (req: ProspectRequest) => {
        setReviewRequest(req);
        setReviewOpen(true);
    };

    const copyPortalUrl = (orgSlug: string) => {
        const url = `${window.location.origin}/portal/${orgSlug}/request`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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

    // Prospect columns
    const prospectColumns: Column<ProspectRequest>[] = [
        {
            key: "firstName" as keyof ProspectRequest,
            label: "Name",
            sortable: true,
            render: (r) => <span className="font-medium">{r.firstName} {r.lastName}</span>,
        },
        { key: "email" as keyof ProspectRequest, label: "Email", sortable: true },
        {
            key: "appointmentType" as keyof ProspectRequest,
            label: "Appt Type",
            render: (r) => <span className="text-sm">{r.appointmentType}</span>,
        },
        {
            key: "preferredDate" as keyof ProspectRequest,
            label: "Preferred",
            render: (r) => (
                <span className="text-sm tabular-nums">
                    {r.preferredDate} {fmtTime(r.preferredTime)}
                </span>
            ),
        },
        {
            key: "status" as keyof ProspectRequest,
            label: "Status",
            render: (r) => {
                const statusMap: Record<string, string> = {
                    pending:                "text-amber-600 border-amber-400",
                    confirmed:              "text-blue-600 border-blue-400",
                    awaiting_payment:       "text-orange-600 border-orange-400",
                    paid:                   "text-green-600 border-green-400",
                    rejected:               "text-red-600 border-red-400",
                    payment_expired:        "text-red-600 border-red-400",
                    accepted_as_client:     "text-green-600 border-green-400",
                    declined_after_meeting: "text-slate-500 border-slate-400",
                };
                const labelMap: Record<string, string> = {
                    pending: "Pending", confirmed: "Confirmed",
                    awaiting_payment: "Awaiting Payment", paid: "Paid",
                    rejected: "Rejected", payment_expired: "Expired",
                    accepted_as_client: "Accepted", declined_after_meeting: "Declined",
                };
                return (
                    <Badge variant="outline" className={statusMap[r.status] ?? "text-muted-foreground border-border"}>
                        {labelMap[r.status] ?? r.status}
                    </Badge>
                );
            },
        },
        {
            key: "_id" as keyof ProspectRequest,
            label: "Actions",
            render: (r) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openReview(r)}>
                        <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Delete permanently"
                        onClick={() => setProspectDeleteDialog({ open: true, prospect: r })}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <RoleGuard allowedRoles={["admin", "accountant"]} redirectTo="/dashboard">
            <div className="space-y-6">
                <PageTitle title="Clients" />
                <PageHeader
                    title="Clients"
                    description="Manage your clients with ease"
                    actionLabel={isAdmin ? "Add Client" : undefined}
                    onAction={isAdmin ? () => { setEditingClient(null); setModalOpen(true); } : undefined}
                />

                <Tabs defaultValue="clients">
                    <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                        <TabsList>
                            <TabsTrigger value="clients">Clients</TabsTrigger>
                            {isAdmin && (
                                <TabsTrigger value="prospects" className="relative">
                                    Prospects
                                    {pendingCount > 0 && (
                                        <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                                            {pendingCount}
                                        </span>
                                    )}
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>

                    <TabsContent value="clients">
                        <DataTable<ConvexClient>
                            data={clients}
                            columns={columns}
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
                    </TabsContent>

                    {isAdmin && (
                        <TabsContent value="prospects">
                            {/* Shareable link banner */}
                            <ProspectLinkBanner onCopy={copyPortalUrl} copied={copied} />
                            <DataTable<ProspectRequest>
                                data={allProspects}
                                columns={prospectColumns}
                                searchKey="firstName"
                                searchPlaceholder="Search prospects..."
                                loading={prospectsQuery === undefined}
                                filterDropdown={{
                                    key: "status",
                                    placeholder: "All Statuses",
                                    options: [
                                        { label: "Pending", value: "pending" },
                                        { label: "Confirmed", value: "confirmed" },
                                        { label: "Rejected", value: "rejected" },
                                    ],
                                }}
                            />
                        </TabsContent>
                    )}
                </Tabs>

                <ClientModal
                    open={modalOpen}
                    onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingClient(null); }}
                    client={editingClient}
                />

                <ProspectReviewModal
                    request={reviewRequest}
                    open={reviewOpen}
                    onOpenChange={(open) => { setReviewOpen(open); if (!open) setReviewRequest(null); }}
                />

                {/* Prospect delete confirmation */}
                <Dialog open={prospectDeleteDialog.open} onOpenChange={(open) => { if (!open) setProspectDeleteDialog({ open: false, prospect: null }); }}>
                    <DialogContent style={{ maxWidth: 460 }}>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                Delete Prospect
                            </DialogTitle>
                            <DialogDescription className="pt-1">
                                This will permanently delete the request from{" "}
                                <span className="font-semibold text-foreground">
                                    {prospectDeleteDialog.prospect?.firstName} {prospectDeleteDialog.prospect?.lastName}
                                </span>
                                . This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setProspectDeleteDialog({ open: false, prospect: null })} disabled={prospectDeleting}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleProspectDelete} disabled={prospectDeleting}>
                                {prospectDeleting ? "Deleting…" : "Delete"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

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

// ─── Prospect link banner ──────────────────────────────────────────────────────

function ProspectLinkBanner({ onCopy, copied }: { onCopy: (slug: string) => void; copied: boolean }) {
    const org = useQuery(api.organisations.queries.mine);
    const portalSettings = useQuery(api.organisations.queries.getPortalSettings);

    if (!org || !portalSettings?.portalSlug) return null;

    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${portalSettings.portalSlug}/request`;

    return (
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">Public request link</p>
                <p className="text-xs text-muted-foreground truncate font-mono">{url}</p>
            </div>
            <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => onCopy(portalSettings.portalSlug!)}
            >
                {copied
                    ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-500" />Copied</>
                    : <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy link</>
                }
            </Button>
        </div>
    );
}
