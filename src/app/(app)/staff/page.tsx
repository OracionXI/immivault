"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { StaffModal } from "./staff-modal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Pencil, UserPlus, Trash2 } from "lucide-react";
import { RoleGuard } from "@/components/shared/role-guard";
import { InviteModal } from "./invite-modal";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";

type ConvexUser = NonNullable<ReturnType<typeof useQuery<typeof api.users.queries.listByOrg>>>[number];

export default function StaffPage() {
    const staffQuery = useQuery(api.users.queries.listByOrg);
    const staff = staffQuery ?? [];
    const deleteStaff = useAction(api.users.actions.deleteStaff);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ConvexUser | null>(null);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<ConvexUser | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        setDeleteError("");
        try {
            await deleteStaff({ id: deleteTarget._id as Id<"users"> });
            setDeleteTarget(null);
        } catch (e: unknown) {
            setDeleteError(e instanceof Error ? e.message : "Failed to delete user.");
        } finally {
            setDeleting(false);
        }
    };

    const columns: Column<ConvexUser>[] = [
        {
            key: "fullName", label: "Name", sortable: true, render: (s) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {s.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium text-sm">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                </div>
            ),
        },
        { key: "role", label: "Role", sortable: true, render: (s) => <span className="capitalize">{s.role}</span> },
        { key: "status", label: "Status", render: (s) => <StatusBadge status={s.status} /> },
        {
            key: "actions", label: "Actions", render: (s) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(s); setModalOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { setDeleteError(""); setDeleteTarget(s); }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <RoleGuard allowedRoles={["admin"]} redirectTo="/dashboard">
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <PageHeader
                    title="Staff Management"
                    description="Manage your team members and their roles"
                />
                <Button onClick={() => setInviteOpen(true)} className="gap-2">
                    <UserPlus className="h-4 w-4" />Invite Staff
                </Button>
            </div>
            <DataTable
                data={staff as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                searchKey="fullName"
                searchPlaceholder="Search staff..."
                loading={staffQuery === undefined}
                filterDropdown={{
                    key: "status",
                    placeholder: "All Staff",
                    options: [
                        { label: "Active", value: "active" },
                        { label: "Inactive", value: "inactive" },
                    ],
                }}
            />
            <StaffModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setEditing(null); }}
                staff={editing}
            />
            <InviteModal open={inviteOpen} onOpenChange={setInviteOpen} />

            {/* Delete confirmation */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Remove Staff Member</DialogTitle>
                        <DialogDescription>
                            This will permanently delete{" "}
                            <span className="font-medium text-foreground">{deleteTarget?.fullName}</span>{" "}
                            from both ImmiVault and Clerk. They will no longer be able to sign in.
                        </DialogDescription>
                    </DialogHeader>
                    {deleteError && (
                        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                            {deleteError}
                        </p>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting ? "Removing…" : "Remove"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </RoleGuard>
    );
}
