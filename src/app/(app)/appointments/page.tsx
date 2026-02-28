"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mockAppointments } from "@/lib/mock-data";
import type { Appointment } from "@/lib/types";
import { AppointmentModal } from "./appointment-modal";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Appointment | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

    const handleSave = (a: Appointment) => {
        if (editing) {
            setAppointments((prev) => prev.map((x) => (x.id === a.id ? a : x)));
        } else {
            setAppointments((prev) => [...prev, { ...a, id: `a${Date.now()}` }]);
        }
        setModalOpen(false);
        setEditing(null);
    };

    const columns: Column<Appointment>[] = [
        { key: "clientName", label: "Client", sortable: true, render: (a) => <span className="font-medium">{a.clientName}</span> },
        { key: "type", label: "Type", sortable: true },
        { key: "date", label: "Date", sortable: true },
        { key: "time", label: "Time" },
        { key: "duration", label: "Duration" },
        { key: "location", label: "Location" },
        { key: "status", label: "Status", render: (a) => <StatusBadge status={a.status} /> },
        {
            key: "actions", label: "Actions", render: (a) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(a); setModalOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, id: a.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Appointments" description="Schedule and manage client appointments" actionLabel="New Appointment" onAction={() => { setEditing(null); setModalOpen(true); }} />
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
            <AppointmentModal open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setEditing(null); }} appointment={editing} onSave={handleSave} />
            <ConfirmDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })} title="Delete Appointment" description="Are you sure you want to delete this appointment?" onConfirm={() => { if (deleteDialog.id) setAppointments((prev) => prev.filter((a) => a.id !== deleteDialog.id)); setDeleteDialog({ open: false, id: null }); }} />
        </div>
    );
}
