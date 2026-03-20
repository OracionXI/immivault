"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
import { KanbanBoard, type KanbanColumn, type KanbanItem } from "@/components/shared/kanban-board";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CaseModal } from "./case-modal";
import { CaseDetailDialog } from "./case-detail-dialog";
import { CasesTableView } from "./cases-table-view";
import { Input } from "@/components/ui/input";
import { Search, X, LayoutDashboard, List } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { RoleGuard } from "@/components/shared/role-guard";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

type ConvexCase = NonNullable<ReturnType<typeof useQuery<typeof api.cases.queries.list>>>[number];
type ViewMode = "kanban" | "table";

const FIXED_STAGES: { name: string; color: string }[] = [
    { name: "To Do", color: "border-amber-400" },
    { name: "In Progress", color: "border-blue-400" },
    { name: "On Hold", color: "border-orange-400" },
    { name: "Completed", color: "border-emerald-400" },
    { name: "Archive", color: "border-slate-400" },
];

const CUSTOM_STAGE_COLORS = [
    "border-purple-400",
    "border-pink-400",
    "border-cyan-400",
    "border-violet-400",
    "border-rose-400",
    "border-teal-400",
    "border-indigo-400",
    "border-lime-400",
];

const VIEW_MODES: { mode: ViewMode; icon: React.ElementType; label: string }[] = [
    { mode: "kanban", icon: LayoutDashboard, label: "Kanban" },
    { mode: "table", icon: List, label: "Table" },
];

export default function CasesPage() {
    const casesQuery = useQuery(api.cases.queries.list);
    const rawCases = casesQuery ?? [];
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];
    const orgSettings = useQuery(api.organisations.queries.getSettings);
    const updateStatus = useMutation(api.cases.mutations.updateStatus);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);
    const removeCase = useMutation(api.cases.mutations.remove);
    const { isAdmin, isCaseManager, user } = useRole();

    const [viewMode, setViewMode] = useState<ViewMode>("kanban");

    const customStageNames = (orgSettings?.caseStages ?? []).filter(
        (s) => !FIXED_STAGES.some((f) => f.name === s)
    );
    const allColumnDefs: KanbanColumn[] = [
        ...FIXED_STAGES.map(({ name, color }) => ({ id: name, title: name, color })),
        ...customStageNames.map((name, i) => ({
            id: name,
            title: name,
            color: CUSTOM_STAGE_COLORS[i % CUSTOM_STAGE_COLORS.length],
        })),
    ];
    const columnDefMap = new Map(allColumnDefs.map((c) => [c.id, c]));

    const savedOrder = orgSettings?.caseColumnOrder;
    const kanbanColumns: KanbanColumn[] = savedOrder
        ? [
            ...savedOrder.flatMap((id) => {
                const col = columnDefMap.get(id);
                return col ? [col] : [];
            }),
            ...allColumnDefs.filter((c) => !savedOrder.includes(c.id)),
        ]
        : allColumnDefs;

    const clientMap = useMemo(
        () => new Map(clients.map((c) => [c._id, `${c.firstName} ${c.lastName}`])),
        [clients]
    );
    const userMap = useMemo(
        () => new Map(users.map((u) => [u._id, u.fullName])),
        [users]
    );

    const [modalOpen, setModalOpen] = useState(false);
    const [editingCase, setEditingCase] = useState<ConvexCase | null>(null);
    const [viewCase, setViewCase] = useState<ConvexCase | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: Id<"cases"> | null }>({ open: false, id: null });
    const [search, setSearch] = useState("");

    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const openId = searchParams.get("open");
        if (!openId || rawCases.length === 0) return;
        const c = rawCases.find((x) => x._id === openId);
        if (c) {
            setViewCase(c);
            router.replace("/cases", { scroll: false });
        }
    }, [searchParams, rawCases, router]);

    useEffect(() => {
        if (casesQuery === undefined) return;
        if (viewCase && !rawCases.some((c) => c._id === viewCase._id)) {
            setViewCase(null);
            toast("Access removed", { description: "You no longer have access to this case." });
        }
        if (editingCase && !rawCases.some((c) => c._id === editingCase._id)) {
            setEditingCase(null);
            setModalOpen(false);
            toast("Access removed", { description: "You no longer have access to this case." });
        }
    }, [rawCases, casesQuery, viewCase, editingCase]);

    // Filtered cases (shared across all view modes)
    const filteredCases = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rawCases;
        return rawCases.filter((c) => {
            const clientName = clientMap.get(c.clientId) ?? "";
            const assigneeName = c.assignedTo ? (userMap.get(c.assignedTo) ?? "") : "";
            return (
                c.title.toLowerCase().includes(q) ||
                clientName.toLowerCase().includes(q) ||
                assigneeName.toLowerCase().includes(q)
            );
        });
    }, [rawCases, clientMap, userMap, search]);

    const kanbanItems: KanbanItem[] = useMemo(() =>
        filteredCases.map((c) => ({
            id: c._id,
            title: c.title,
            subtitle: clientMap.get(c.clientId) ?? "—",
            status: c.status,
            priority: c.priority,
            assignee: c.assignedTo ? (userMap.get(c.assignedTo) ?? "—") : "Unassigned",
            assignedToId: c.assignedTo ?? null,
            dueDate: c.deadline ? new Date(c.deadline).toISOString().split("T")[0] : undefined,
        })),
        [filteredCases, clientMap, userMap]
    );

    const handleItemClick = (item: KanbanItem) => {
        const c = rawCases.find((x) => x._id === item.id);
        if (c) setViewCase(c);
    };

    const handleItemEdit = (item: KanbanItem) => {
        const c = rawCases.find((x) => x._id === item.id);
        if (c) { setEditingCase(c); setModalOpen(true); }
    };

    const handleItemDelete = (item: KanbanItem) => {
        setDeleteDialog({ open: true, id: item.id as Id<"cases"> });
    };

    const handleItemMove = async (itemId: string, newStatus: string) => {
        try {
            await updateStatus({ id: itemId as Id<"cases">, status: newStatus });
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleColumnReorder = async (newOrder: string[]) => {
        try {
            await updateSettings({ caseColumnOrder: newOrder });
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleDelete = async () => {
        if (deleteDialog.id) {
            try {
                await removeCase({ id: deleteDialog.id });
                setDeleteDialog({ open: false, id: null });
            } catch (error) {
                toast.error(getErrorMessage(error));
            }
        }
    };

    return (
        <RoleGuard allowedRoles={["admin", "case_manager", "staff"]}>
        <div className="space-y-6">
            <PageHeader
                title="Cases"
                description="Manage cases with drag & drop feature"
                actionLabel={isAdmin ? "New Case" : undefined}
                onAction={isAdmin ? () => { setEditingCase(null); setModalOpen(true); } : undefined}
            />

            <div className="flex items-center gap-3 w-full">
                <div className="relative w-1/2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Search cases or clients…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-8"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* View mode toggle */}
                <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 ml-auto">
                    {VIEW_MODES.map(({ mode, icon: Icon, label }) => (
                        <button
                            key={mode}
                            title={label}
                            onClick={() => setViewMode(mode)}
                            className={`p-1.5 rounded-md transition-colors ${
                                viewMode === mode
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                        </button>
                    ))}
                </div>

                {search && (
                    <p className="text-sm text-muted-foreground whitespace-nowrap">
                        {filteredCases.length} result{filteredCases.length !== 1 ? "s" : ""}
                    </p>
                )}
            </div>

            {casesQuery === undefined ? (
                <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-72 space-y-3">
                            <div className="h-6 w-24 rounded bg-muted animate-pulse" />
                            {Array.from({ length: 3 }).map((_, j) => (
                                <div key={j} className="rounded-lg border border-border bg-card p-3 space-y-2">
                                    <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                                    <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ) : viewMode === "table" ? (
                <CasesTableView
                    cases={filteredCases}
                    clientMap={clientMap}
                    userMap={userMap}
                    onView={(c) => setViewCase(c)}
                    onEdit={(isAdmin || isCaseManager) ? (c) => { setEditingCase(c); setModalOpen(true); } : undefined}
                    canEdit={isCaseManager ? (c) => c.assignedTo === user?._id : undefined}
                    onDelete={isAdmin ? (c) => setDeleteDialog({ open: true, id: c._id }) : undefined}
                />
            ) : (
                <KanbanBoard
                    columns={kanbanColumns}
                    items={kanbanItems}
                    statusKey="status"
                    disabledStatuses={["Archive", "Archived"]}
                    onItemClick={handleItemClick}
                    onItemEdit={(isAdmin || isCaseManager) ? handleItemEdit : undefined}
                    canEditItem={isCaseManager ? (item) => item.assignedToId === user?._id : undefined}
                    onItemDelete={isAdmin ? handleItemDelete : undefined}
                    onItemMove={handleItemMove}
                    onColumnReorder={isAdmin ? handleColumnReorder : undefined}
                />
            )}

            {(isAdmin || isCaseManager) && (
                <CaseModal
                    open={modalOpen}
                    onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingCase(null); }}
                    caseItem={editingCase}
                />
            )}

            <CaseDetailDialog
                caseItem={viewCase}
                clientName={viewCase ? (clientMap.get(viewCase.clientId) ?? "—") : ""}
                assigneeName={
                    viewCase
                        ? (viewCase.assignedTo ? (userMap.get(viewCase.assignedTo) ?? "—") : "Unassigned")
                        : ""
                }
                onClose={() => setViewCase(null)}
                onEdit={isAdmin ? (c) => { setViewCase(null); setEditingCase(c); setModalOpen(true); } : undefined}
            />

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
                title="Delete Case"
                description="Are you sure you want to delete this case? This action cannot be undone."
                onConfirm={handleDelete}
            />
        </div>
        </RoleGuard>
    );
}
