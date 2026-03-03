"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
import { KanbanBoard, type KanbanColumn, type KanbanItem } from "@/components/shared/kanban-board";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CaseModal } from "./case-modal";
import { CaseDetailDialog } from "./case-detail-dialog";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useRole } from "@/hooks/use-role";

type ConvexCase = NonNullable<ReturnType<typeof useQuery<typeof api.cases.queries.list>>>[number];

const KANBAN_COLUMNS: KanbanColumn[] = [
    { id: "Active",    title: "Active",    color: "border-amber-400" },
    { id: "Pending",   title: "Pending",   color: "border-blue-400" },
    { id: "On Hold",   title: "On Hold",   color: "border-orange-400" },
    { id: "Completed", title: "Completed", color: "border-emerald-400" },
    { id: "Rejected",  title: "Rejected",  color: "border-red-400" },
    { id: "Archived",  title: "Archived",  color: "border-gray-400" },
];

export default function CasesPage() {
    const rawCases = useQuery(api.cases.queries.list) ?? [];
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];
    const tasks = useQuery(api.tasks.queries.list) ?? [];
    const updateStatus = useMutation(api.cases.mutations.updateStatus);
    const removeCase = useMutation(api.cases.mutations.remove);
    const { isAdmin, isCaseManager, user } = useRole();

    const clientMap = useMemo(
        () => new Map(clients.map((c) => [c._id, `${c.firstName} ${c.lastName}`])),
        [clients]
    );
    const userMap = useMemo(
        () => new Map(users.map((u) => [u._id, u.fullName])),
        [users]
    );
    const tasksByCase = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const t of tasks) {
            if (!t.caseId) continue;
            const chips = map.get(t.caseId) ?? [];
            const label = `${t.taskId}: ${t.title.length > 22 ? t.title.slice(0, 22) + "…" : t.title}`;
            chips.push(label);
            map.set(t.caseId, chips);
        }
        return map;
    }, [tasks]);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingCase, setEditingCase] = useState<ConvexCase | null>(null);
    const [viewCase, setViewCase] = useState<ConvexCase | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: Id<"cases"> | null }>({ open: false, id: null });
    const [search, setSearch] = useState("");

    const kanbanItems: KanbanItem[] = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rawCases
            .map((c) => ({
                id: c._id,
                title: c.title,
                subtitle: clientMap.get(c.clientId) ?? "—",
                status: c.status,
                priority: c.priority,
                assignee: c.assignedTo ? (userMap.get(c.assignedTo) ?? "—") : "Unassigned",
                assignedToId: c.assignedTo ?? null,
                dueDate: c.deadline ? new Date(c.deadline).toISOString().split("T")[0] : undefined,
                taskChips: tasksByCase.get(c._id) ?? [],
            }))
            .filter((item) => {
                if (!q) return true;
                return (
                    item.title.toLowerCase().includes(q) ||
                    (item.subtitle?.toLowerCase() ?? "").includes(q) ||
                    (item.assignee?.toLowerCase() ?? "").includes(q)
                );
            });
    }, [rawCases, clientMap, userMap, tasksByCase, search]);

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
        await updateStatus({ id: itemId as Id<"cases">, status: newStatus as ConvexCase["status"] });
    };

    const handleDelete = async () => {
        if (deleteDialog.id) {
            await removeCase({ id: deleteDialog.id });
            setDeleteDialog({ open: false, id: null });
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Cases"
                description="Manage immigration cases with drag & drop"
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
                {search && (
                    <p className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
                        {kanbanItems.length} result{kanbanItems.length !== 1 ? "s" : ""}
                    </p>
                )}
            </div>

            <KanbanBoard
                columns={KANBAN_COLUMNS}
                items={kanbanItems}
                statusKey="status"
                disabledStatuses={["Archived"]}
                onItemClick={handleItemClick}
                onItemEdit={(isAdmin || isCaseManager) ? handleItemEdit : undefined}
                canEditItem={isCaseManager ? (item) => item.assignedToId === user?._id : undefined}
                onItemDelete={isAdmin ? handleItemDelete : undefined}
                onItemMove={handleItemMove}
            />

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
    );
}
