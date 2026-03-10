"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
import { KanbanBoard, type KanbanColumn, type KanbanItem } from "@/components/shared/kanban-board";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TaskModal } from "./task-modal";
import { TaskDetailDialog } from "./task-detail-dialog";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";

type ConvexTask = NonNullable<ReturnType<typeof useQuery<typeof api.tasks.queries.list>>>[number];

const TASK_COLUMNS: KanbanColumn[] = [
    { id: "To Do",       title: "To Do",       color: "border-blue-400"    },
    { id: "In Progress", title: "In Progress",  color: "border-amber-400"   },
    { id: "In Review",   title: "In Review",    color: "border-violet-400"  },
    { id: "On Hold",     title: "On Hold",      color: "border-orange-400"  },
    { id: "Completed",   title: "Completed",    color: "border-emerald-400" },
    { id: "Rejected",    title: "Rejected",     color: "border-red-400"     },
];

const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export default function TasksPage() {
    const tasksQuery = useQuery(api.tasks.queries.list);
    const rawTasks = tasksQuery ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];
    const cases = useQuery(api.cases.queries.listAll) ?? [];
    const updateStatus = useMutation(api.tasks.mutations.updateStatus);
    const removeTask = useMutation(api.tasks.mutations.remove);
    const { isStaff } = useRole();

    const userMap = useMemo(
        () => new Map(users.map((u) => [u._id, u.fullName])),
        [users]
    );
    const caseMap = useMemo(
        () => new Map(cases.map((c) => [c._id, c.title])),
        [cases]
    );

    const [modalOpen, setModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<ConvexTask | null>(null);
    const [viewTask, setViewTask] = useState<ConvexTask | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: Id<"tasks"> | null }>({ open: false, id: null });
    const [search, setSearch] = useState("");
    const [assigneeFilter, setAssigneeFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");

    const searchParams = useSearchParams();
    const router = useRouter();

    // Case filter: pre-populated from ?case=caseId (set by clicking "Tasks" on a case card)
    const [caseIdFilter, setCaseIdFilter] = useState<string>(() => searchParams.get("case") ?? "");
    const filteredCaseName = caseIdFilter ? (caseMap.get(caseIdFilter as Id<"cases">) ?? "Selected case") : null;

    // Auto-open a specific task when navigated from a notification (?open=taskId)
    useEffect(() => {
        const openId = searchParams.get("open");
        if (!openId || rawTasks.length === 0) return;
        const t = rawTasks.find((x) => x._id === openId);
        if (t) {
            setViewTask(t);
            router.replace("/tasks", { scroll: false });
        }
    }, [searchParams, rawTasks, router]);

    const kanbanItems: KanbanItem[] = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rawTasks
            .filter((t) => !caseIdFilter || t.caseId === caseIdFilter)
            .map((t) => ({
                id: t._id,
                title: t.title,
                subtitle: t.caseId ? (caseMap.get(t.caseId) ?? "—") : (t.description ?? ""),
                status: t.status,
                priority: t.priority,
                assignee: t.assignedTo ? (userMap.get(t.assignedTo) ?? "—") : "Unassigned",
                dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : undefined,
            }))
            .filter((item) => {
                if (q && !item.title.toLowerCase().includes(q) && !(item.subtitle?.toLowerCase() ?? "").includes(q)) return false;
                if (assigneeFilter !== "all" && item.assignee !== assigneeFilter) return false;
                if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
                return true;
            });
    }, [rawTasks, userMap, caseMap, search, assigneeFilter, priorityFilter, caseIdFilter]);

    const isFiltering = search || assigneeFilter !== "all" || priorityFilter !== "all" || caseIdFilter;
    const activeUsers = users.filter((u) => u.status === "active");

    const handleItemClick = (item: KanbanItem) => {
        const t = rawTasks.find((x) => x._id === item.id);
        if (t) setViewTask(t);
    };

    const handleItemEdit = (item: KanbanItem) => {
        const t = rawTasks.find((x) => x._id === item.id);
        if (t) { setEditingTask(t); setModalOpen(true); }
    };

    const handleItemDelete = (item: KanbanItem) => {
        setDeleteDialog({ open: true, id: item.id as Id<"tasks"> });
    };

    const handleItemMove = async (itemId: string, newStatus: string) => {
        try {
            await updateStatus({ id: itemId as Id<"tasks">, status: newStatus as ConvexTask["status"] });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update task.";
            toast.error(message);
        }
    };

    const handleDelete = async () => {
        if (deleteDialog.id) {
            try {
                await removeTask({ id: deleteDialog.id });
                setDeleteDialog({ open: false, id: null });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to delete task.";
                toast.error(message);
                setDeleteDialog({ open: false, id: null });
            }
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tasks"
                description="Track and manage tasks with drag & drop"
                actionLabel="New Task"
                onAction={() => { setEditingTask(null); setModalOpen(true); }}
            />

            <div className="flex items-center gap-3 w-full">
                <div className="relative w-1/2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Search tasks or cases…"
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

                <div className="ml-auto flex items-center gap-2">
                    <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="All Assignees" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Assignees</SelectItem>
                            {activeUsers.map((u) => (
                                <SelectItem key={u._id} value={u.fullName}>{u.fullName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Priorities" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            {TASK_PRIORITIES.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {isFiltering && (
                        <p className="text-sm text-muted-foreground whitespace-nowrap pl-1">
                            {kanbanItems.length} task{kanbanItems.length !== 1 ? "s" : ""}
                        </p>
                    )}
                </div>
            </div>

            {filteredCaseName && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Filtered by case:</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                        {filteredCaseName}
                        <button
                            onClick={() => setCaseIdFilter("")}
                            className="text-primary/70 hover:text-primary transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                </div>
            )}

            {tasksQuery === undefined ? (
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
            ) : (
                <KanbanBoard
                    columns={TASK_COLUMNS}
                    items={kanbanItems}
                    statusKey="status"
                    onItemClick={handleItemClick}
                    onItemEdit={isStaff ? undefined : handleItemEdit}
                    onItemDelete={isStaff ? undefined : handleItemDelete}
                    onItemMove={handleItemMove}
                />
            )}

            <TaskModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingTask(null); }}
                task={editingTask}
            />

            <TaskDetailDialog
                task={viewTask}
                assigneeName={viewTask ? (viewTask.assignedTo ? (userMap.get(viewTask.assignedTo) ?? "—") : "Unassigned") : ""}
                caseName={viewTask?.caseId ? (caseMap.get(viewTask.caseId) ?? "") : ""}
                onClose={() => setViewTask(null)}
                onEdit={isStaff ? undefined : (t) => { setViewTask(null); setEditingTask(t); setModalOpen(true); }}
            />

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
                title="Delete Task"
                description="Are you sure you want to delete this task?"
                onConfirm={handleDelete}
            />
        </div>
    );
}
