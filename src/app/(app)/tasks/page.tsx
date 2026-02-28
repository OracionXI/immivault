"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KanbanBoard, type KanbanColumn, type KanbanItem } from "@/components/shared/kanban-board";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mockTasks, mockStaff } from "@/lib/mock-data";
import type { Task } from "@/lib/types";
import { TaskModal } from "./task-modal";
import { TaskDetailDialog } from "./task-detail-dialog";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

const taskColumns: KanbanColumn[] = [
    { id: "To Do", title: "To Do", color: "#3b82f6" },
    { id: "In Progress", title: "In Progress", color: "#f59e0b" },
    { id: "Review", title: "Review", color: "#8b5cf6" },
    { id: "Done", title: "Done", color: "#10b981" },
];

const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const activeStaff = mockStaff.filter((s) => s.status === "active");

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>(mockTasks);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [viewTask, setViewTask] = useState<Task | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
    const [search, setSearch] = useState("");
    const [assigneeFilter, setAssigneeFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");

    const allKanbanItems: KanbanItem[] = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: t.caseName || t.description,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
        dueDate: t.dueDate,
    }));

    const kanbanItems = useMemo(() => {
        let result = allKanbanItems;
        const q = search.trim().toLowerCase();
        if (q) {
            result = result.filter(
                (item) =>
                    item.title.toLowerCase().includes(q) ||
                    (item.subtitle?.toLowerCase() ?? "").includes(q)
            );
        }
        if (assigneeFilter !== "all") {
            result = result.filter((item) => item.assignee === assigneeFilter);
        }
        if (priorityFilter !== "all") {
            result = result.filter((item) => item.priority === priorityFilter);
        }
        return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks, search, assigneeFilter, priorityFilter]);

    const isFiltering = search || assigneeFilter !== "all" || priorityFilter !== "all";

    const handleSave = (t: Task) => {
        if (editingTask) {
            setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)));
        } else {
            setTasks((prev) => [...prev, { ...t, id: `t${Date.now()}` }]);
        }
        setModalOpen(false);
        setEditingTask(null);
    };

    const handleItemClick = (item: KanbanItem) => {
        const t = tasks.find((x) => x.id === item.id);
        if (t) setViewTask(t);
    };

    const handleItemEdit = (item: KanbanItem) => {
        const t = tasks.find((x) => x.id === item.id);
        if (t) { setEditingTask(t); setModalOpen(true); }
    };

    const handleItemDelete = (item: KanbanItem) => {
        setDeleteDialog({ open: true, id: item.id });
    };

    const handleItemMove = (itemId: string, newStatus: string) => {
        setTasks((prev) =>
            prev.map((t) => (t.id === itemId ? { ...t, status: newStatus as Task["status"] } : t))
        );
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tasks"
                description="Track and manage tasks with drag & drop"
                actionLabel="New Task"
                onAction={() => { setEditingTask(null); setModalOpen(true); }}
            />

            {/* Toolbar */}
            <div className="flex items-center gap-3 w-full">
                {/* Search — 50% width */}
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

                {/* Filters — right-aligned */}
                <div className="ml-auto flex items-center gap-2">
                    {/* Assignee dropdown */}
                    <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                        <SelectTrigger className="w-44">
                            <SelectValue placeholder="All Assignees" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Assignees</SelectItem>
                            {activeStaff.map((s) => (
                                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Status dropdown */}
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

                    {/* Result count */}
                    {isFiltering && (
                        <p className="text-sm text-muted-foreground whitespace-nowrap pl-1">
                            {kanbanItems.length} task{kanbanItems.length !== 1 ? "s" : ""}
                        </p>
                    )}
                </div>
            </div>

            <KanbanBoard
                columns={taskColumns}
                items={kanbanItems}
                statusKey="status"
                onItemClick={handleItemClick}
                onItemEdit={handleItemEdit}
                onItemDelete={handleItemDelete}
                onItemMove={handleItemMove}
            />

            <TaskModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingTask(null); }}
                task={editingTask}
                onSave={handleSave}
            />

            <TaskDetailDialog
                task={viewTask}
                onClose={() => setViewTask(null)}
                onEdit={(t) => { setEditingTask(t); setModalOpen(true); }}
            />

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
                title="Delete Task"
                description="Are you sure you want to delete this task?"
                onConfirm={() => {
                    if (deleteDialog.id) setTasks((prev) => prev.filter((t) => t.id !== deleteDialog.id));
                    setDeleteDialog({ open: false, id: null });
                }}
            />
        </div>
    );
}
