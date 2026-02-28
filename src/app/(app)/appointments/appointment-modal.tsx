"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Appointment, AppointmentType } from "@/lib/types";
import { mockClients } from "@/lib/mock-data";

interface AppointmentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appointment: Appointment | null;
    onSave: (a: Appointment) => void;
}

const appointmentTypes: AppointmentType[] = ["Consultation", "Document Review", "Interview Prep", "Follow-up", "Other"];

export function AppointmentModal({ open, onOpenChange, appointment, onSave }: AppointmentModalProps) {
    const [form, setForm] = useState({ clientId: "", type: "Consultation" as AppointmentType, date: "", time: "", duration: "60 min", location: "", notes: "" });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (appointment) {
            setForm({ clientId: appointment.clientId, type: appointment.type, date: appointment.date, time: appointment.time, duration: appointment.duration, location: appointment.location, notes: appointment.notes });
        } else {
            setForm({ clientId: "", type: "Consultation", date: "", time: "", duration: "60 min", location: "", notes: "" });
        }
        setErrors({});
    }, [appointment, open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.clientId) errs.clientId = "Client is required";
        if (!form.date) errs.date = "Date is required";
        if (!form.time) errs.time = "Time is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        const client = mockClients.find((c) => c.id === form.clientId);
        onSave({ id: appointment?.id || "", ...form, clientName: client?.name || "", status: "active" });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader><DialogTitle>{appointment ? "Edit Appointment" : "New Appointment"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Client *</Label>
                            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                <SelectContent>{mockClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Type</Label>
                            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AppointmentType })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{appointmentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
                            <Select value={form.duration} onValueChange={(v) => setForm({ ...form, duration: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["15 min", "30 min", "45 min", "60 min", "90 min", "120 min"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
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
                    <Button onClick={handleSubmit}>{appointment ? "Save Changes" : "Create Appointment"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
