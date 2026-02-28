"use client";

import { useState, useEffect } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Case, CaseStage, Priority } from "@/lib/types";
import { mockClients, mockStaff } from "@/lib/mock-data";

interface CaseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    caseItem: Case | null;
    onSave: (c: Case) => void;
}

export function CaseModal({ open, onOpenChange, caseItem, onSave }: CaseModalProps) {
    const [form, setForm] = useState({ title: "", clientId: "", visaType: "", stage: "New" as CaseStage, assignedTo: "", priority: "Medium" as Priority, notes: "" });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (caseItem) {
            setForm({ title: caseItem.title, clientId: caseItem.clientId, visaType: caseItem.visaType, stage: caseItem.stage, assignedTo: caseItem.assignedTo, priority: caseItem.priority, notes: caseItem.notes });
        } else {
            setForm({ title: "", clientId: "", visaType: "", stage: "New", assignedTo: "", priority: "Medium", notes: "" });
        }
        setErrors({});
    }, [caseItem, open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.title.trim()) errs.title = "Title is required";
        if (!form.clientId) errs.clientId = "Client is required";
        if (!form.visaType.trim()) errs.visaType = "Visa type is required";
        if (!form.assignedTo) errs.assignedTo = "Assignee is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        const client = mockClients.find((c) => c.id === form.clientId);
        const now = new Date().toISOString().split("T")[0];
        onSave({ id: caseItem?.id || "", ...form, clientName: client?.name || "", createdAt: caseItem?.createdAt || now, updatedAt: now });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader><DialogTitle>{caseItem ? "Edit Case" : "New Case"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Case Title *</Label>
                        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., H-1B Petition – John Doe" />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>
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
                            <Label>Visa Type *</Label>
                            <Input value={form.visaType} onChange={(e) => setForm({ ...form, visaType: e.target.value })} placeholder="e.g., H-1B" />
                            {errors.visaType && <p className="text-xs text-destructive">{errors.visaType}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label>Stage</Label>
                            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as CaseStage })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["New", "In Progress", "Under Review", "Approved", "Closed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Assigned To *</Label>
                            <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>{mockStaff.filter((s) => s.status === "active").map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                            {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Priority</Label>
                            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["Low", "Medium", "High", "Urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={3} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>{caseItem ? "Save Changes" : "Create Case"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
