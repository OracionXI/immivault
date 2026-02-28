"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KanbanBoard, type KanbanColumn, type KanbanItem } from "@/components/shared/kanban-board";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mockCases, mockCaseStages } from "@/lib/mock-data";
import type { Case } from "@/lib/types";
import { CaseModal } from "./case-modal";
import { CaseDetailDialog } from "./case-detail-dialog";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

export default function CasesPage() {
    const [cases, setCases] = useState<Case[]>(mockCases);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCase, setEditingCase] = useState<Case | null>(null);
    const [viewCase, setViewCase] = useState<Case | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
    const [search, setSearch] = useState("");

    const columns: KanbanColumn[] = mockCaseStages.map((s) => ({
        id: s.name,
        title: s.name,
        color: s.color,
    }));

    const allKanbanItems: KanbanItem[] = cases.map((c) => ({
        id: c.id,
        title: c.title,
        subtitle: c.clientName,
        status: c.stage,
        priority: c.priority,
        assignee: c.assignedTo,
        dueDate: c.updatedAt,
    }));

    const kanbanItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allKanbanItems;
        return allKanbanItems.filter(
            (item) =>
                item.title.toLowerCase().includes(q) ||
                (item.subtitle?.toLowerCase() ?? "").includes(q) ||
                (item.assignee?.toLowerCase() ?? "").includes(q)
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cases, search]);

    const handleSave = (c: Case) => {
        if (editingCase) {
            setCases((prev) => prev.map((x) => (x.id === c.id ? c : x)));
        } else {
            setCases((prev) => [...prev, { ...c, id: `cs${Date.now()}` }]);
        }
        setModalOpen(false);
        setEditingCase(null);
    };

    const handleItemClick = (item: KanbanItem) => {
        const c = cases.find((x) => x.id === item.id);
        if (c) setViewCase(c);
    };

    const handleItemEdit = (item: KanbanItem) => {
        const c = cases.find((x) => x.id === item.id);
        if (c) { setEditingCase(c); setModalOpen(true); }
    };

    const handleItemDelete = (item: KanbanItem) => {
        setDeleteDialog({ open: true, id: item.id });
    };

    const handleItemMove = (itemId: string, newStatus: string) => {
        setCases((prev) =>
            prev.map((c) => (c.id === itemId ? { ...c, stage: newStatus as Case["stage"] } : c))
        );
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Cases"
                description="Manage immigration cases with drag & drop"
                actionLabel="New Case"
                onAction={() => { setEditingCase(null); setModalOpen(true); }}
            />

            {/* Toolbar */}
            <div className="flex items-center gap-3 w-full">
                {/* Search — 50% width */}
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

                {/* Result count — right-aligned */}
                {search && (
                    <p className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
                        {kanbanItems.length} result{kanbanItems.length !== 1 ? "s" : ""}
                    </p>
                )}
            </div>

            <KanbanBoard
                columns={columns}
                items={kanbanItems}
                statusKey="status"
                onItemClick={handleItemClick}
                onItemEdit={handleItemEdit}
                onItemDelete={handleItemDelete}
                onItemMove={handleItemMove}
            />

            <CaseModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setEditingCase(null); }}
                caseItem={editingCase}
                onSave={handleSave}
            />

            <CaseDetailDialog
                caseItem={viewCase}
                onClose={() => setViewCase(null)}
                onEdit={(c) => { setEditingCase(c); setModalOpen(true); }}
            />

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
                title="Delete Case"
                description="Are you sure you want to delete this case? This action cannot be undone."
                onConfirm={() => {
                    if (deleteDialog.id) setCases((prev) => prev.filter((c) => c.id !== deleteDialog.id));
                    setDeleteDialog({ open: false, id: null });
                }}
            />
        </div>
    );
}
