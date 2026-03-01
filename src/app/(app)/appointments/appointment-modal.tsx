"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ConvexAppointment = NonNullable<ReturnType<typeof useQuery<typeof api.appointments.queries.list>>>[number];

interface AppointmentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appointment: ConvexAppointment | null;
}

const APPOINTMENT_TYPES = ["Consultation", "Document Review", "Interview Prep", "Follow-up"] as const;
const DURATION_MINS = [15, 30, 45, 60, 90, 120] as const;

function tsToDateStr(ts: number) {
    return new Date(ts).toISOString().split("T")[0];
}

function tsToTimeStr(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toTimestamp(dateStr: string, timeStr: string) {
    return new Date(`${dateStr}T${timeStr}`).getTime();
}

export function AppointmentModal({ open, onOpenChange, appointment }: AppointmentModalProps) {
    const createAppointment = useMutation(api.appointments.mutations.create);
    const updateAppointment = useMutation(api.appointments.mutations.update);
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];

    const [form, setForm] = useState({
        clientId: "",
        assignedTo: "",
        title: "",
        type: "Consultation" as typeof APPOINTMENT_TYPES[number],
        status: "Scheduled" as "Scheduled" | "Confirmed" | "Completed" | "Cancelled",
        date: "",
        time: "",
        durationMins: 60,
        location: "",
        notes: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (appointment) {
            setForm({
                clientId: appointment.clientId,
                assignedTo: appointment.assignedTo,
                title: appointment.title,
                type: appointment.type,
                status: appointment.status,
                date: tsToDateStr(appointment.startAt),
                time: tsToTimeStr(appointment.startAt),
                durationMins: Math.round((appointment.endAt - appointment.startAt) / 60000),
                location: appointment.location ?? "",
                notes: appointment.notes ?? "",
            });
        } else {
            setForm({ clientId: "", assignedTo: "", title: "", type: "Consultation", status: "Scheduled", date: "", time: "", durationMins: 60, location: "", notes: "" });
        }
        setErrors({});
    }, [appointment, open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.clientId) errs.clientId = "Client is required";
        if (!form.assignedTo) errs.assignedTo = "Staff member is required";
        if (!form.title.trim()) errs.title = "Title is required";
        if (!form.date) errs.date = "Date is required";
        if (!form.time) errs.time = "Time is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const startAt = toTimestamp(form.date, form.time);
            const endAt = startAt + form.durationMins * 60 * 1000;
            const payload = {
                clientId: form.clientId as Id<"clients">,
                assignedTo: form.assignedTo as Id<"users">,
                title: form.title,
                type: form.type,
                status: form.status,
                startAt,
                endAt,
                location: form.location || undefined,
                notes: form.notes || undefined,
            };
            if (appointment) {
                await updateAppointment({ id: appointment._id, ...payload });
            } else {
                await createAppointment(payload);
            }
            onOpenChange(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>{appointment ? "Edit Appointment" : "New Appointment"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Title *</Label>
                        <Input
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="e.g., Initial consultation"
                        />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Client *</Label>
                            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                <SelectContent>
                                    {clients.map((c) => (
                                        <SelectItem key={c._id} value={c._id}>{c.firstName} {c.lastName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Staff Member *</Label>
                            <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                                <SelectContent>
                                    {users.filter((u) => u.status === "active").map((u) => (
                                        <SelectItem key={u._id} value={u._id}>{u.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Type</Label>
                            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof form.type })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {APPOINTMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["Scheduled", "Confirmed", "Completed", "Cancelled"].map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label>Date *</Label>
                            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Time *</Label>
                            <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                            {errors.time && <p className="text-xs text-destructive">{errors.time}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Duration</Label>
                            <Select value={String(form.durationMins)} onValueChange={(v) => setForm({ ...form, durationMins: Number(v) })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {DURATION_MINS.map((d) => (
                                        <SelectItem key={d} value={String(d)}>{d < 60 ? `${d} min` : `${d / 60}h`}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Location</Label>
                        <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g., Office – Room 201 or Virtual – Zoom" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={3} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>{appointment ? "Save Changes" : "Create Appointment"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
