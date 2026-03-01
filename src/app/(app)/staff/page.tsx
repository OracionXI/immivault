"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { StaffModal } from "./staff-modal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Pencil } from "lucide-react";

type ConvexUser = NonNullable<ReturnType<typeof useQuery<typeof api.users.queries.listByOrg>>>[number];

export default function StaffPage() {
    const staff = useQuery(api.users.queries.listByOrg) ?? [];

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ConvexUser | null>(null);

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
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Staff Management"
                description="Manage your team members and their roles"
            />
            <DataTable
                data={staff as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                searchKey="fullName"
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
            <StaffModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setEditing(null); }}
                staff={editing}
            />
        </div>
    );
}
