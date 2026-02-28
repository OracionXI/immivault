"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mockStaff } from "@/lib/mock-data";
import type { Staff } from "@/lib/types";
import { StaffModal } from "./staff-modal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Pencil, Trash2 } from "lucide-react";

export default function StaffPage() {
    const [staff, setStaff] = useState<Staff[]>(mockStaff);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Staff | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

    const handleSave = (s: Staff) => {
        if (editing) {
            setStaff((prev) => prev.map((x) => (x.id === s.id ? s : x)));
        } else {
            setStaff((prev) => [...prev, { ...s, id: `s${Date.now()}` }]);
        }
        setModalOpen(false);
        setEditing(null);
    };

    const columns: Column<Staff>[] = [
        {
            key: "name", label: "Name", sortable: true, render: (s) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-primary/10 text-primary">{s.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback></Avatar>
                    <div><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-muted-foreground">{s.email}</p></div>
                </div>
            ),
        },
        { key: "role", label: "Role", sortable: true },
        { key: "department", label: "Department", sortable: true },
        { key: "joinedAt", label: "Joined", sortable: true },
        { key: "status", label: "Status", render: (s) => <StatusBadge status={s.status} /> },
        {
            key: "actions", label: "Actions", render: (s) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(s); setModalOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, id: s.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Staff Management" description="Manage your team members" actionLabel="Add Staff" onAction={() => { setEditing(null); setModalOpen(true); }} />
            <DataTable
                data={staff as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                searchKey="name"
                searchPlaceholder="Search staff..."
                filterDropdown={{
                    key: "status",
                    placeholder: "All Staff",
                    options: [
                        { label: "Active", value: "active" },
                        { label: "Inactive", value: "inactive" },
                    ],
                }}
            />
            <StaffModal open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setEditing(null); }} staff={editing} onSave={handleSave} />
            <ConfirmDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })} title="Remove Staff" description="Are you sure you want to remove this staff member?" onConfirm={() => { if (deleteDialog.id) setStaff((prev) => prev.filter((s) => s.id !== deleteDialog.id)); setDeleteDialog({ open: false, id: null }); }} />
        </div>
    );
}
