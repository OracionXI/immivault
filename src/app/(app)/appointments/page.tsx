"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AppointmentModal } from "./appointment-modal";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

type ConvexAppointment = NonNullable<ReturnType<typeof useQuery<typeof api.appointments.queries.list>>>[number];
type DisplayAppointment = ConvexAppointment & {
    clientName: string;
    dateDisplay: string;
    timeDisplay: string;
    durationDisplay: string;
};

function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDuration(startAt: number, endAt: number) {
    const mins = Math.round((endAt - startAt) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}

export default function AppointmentsPage() {
    const rawAppointments = useQuery(api.appointments.queries.list) ?? [];
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const removeAppointment = useMutation(api.appointments.mutations.remove);

    const clientMap = useMemo(
        () => new Map(clients.map((c) => [c._id, `${c.firstName} ${c.lastName}`])),
        [clients]
    );

    const appointments = useMemo<DisplayAppointment[]>(
        () => rawAppointments.map((a) => ({
            ...a,
            clientName: clientMap.get(a.clientId) ?? "—",
            dateDisplay: formatDate(a.startAt),
            timeDisplay: formatTime(a.startAt),
            durationDisplay: formatDuration(a.startAt, a.endAt),
        })),
        [rawAppointments, clientMap]
    );

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ConvexAppointment | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: Id<"appointments"> | null }>({ open: false, id: null });

    const handleDelete = async () => {
        if (deleteDialog.id) {
            await removeAppointment({ id: deleteDialog.id });
            setDeleteDialog({ open: false, id: null });
        }
    };

    const columns: Column<DisplayAppointment>[] = [
        { key: "clientName", label: "Client", sortable: true, render: (a) => <span className="font-medium">{a.clientName}</span> },
        { key: "type", label: "Type", sortable: true },
        { key: "dateDisplay", label: "Date", sortable: true },
        { key: "timeDisplay", label: "Time" },
        { key: "durationDisplay", label: "Duration" },
        { key: "location", label: "Location", render: (a) => <span>{a.location ?? "—"}</span> },
        { key: "status", label: "Status", render: (a) => <StatusBadge status={a.status} /> },
        {
            key: "actions", label: "Actions", render: (a) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(a); setModalOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, id: a._id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Appointments"
                description="Schedule and manage client appointments"
                actionLabel="New Appointment"
                onAction={() => { setEditing(null); setModalOpen(true); }}
            />
            <DataTable
                data={appointments as unknown as Record<string, unknown>[]}
                columns={columns as unknown as Column<Record<string, unknown>>[]}
                searchKey="clientName"
                searchPlaceholder="Search appointments..."
                filterDropdown={{
                    key: "type",
                    placeholder: "All Types",
                    options: [
                        { label: "Consultation", value: "Consultation" },
                        { label: "Document Review", value: "Document Review" },
                        { label: "Interview Prep", value: "Interview Prep" },
                        { label: "Follow-up", value: "Follow-up" },
                    ],
                }}
            />
            <AppointmentModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setEditing(null); }}
                appointment={editing}
            />
            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
                title="Delete Appointment"
                description="Are you sure you want to delete this appointment?"
                onConfirm={handleDelete}
            />
        </div>
    );
}
