"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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

type ConvexCase = NonNullable<ReturnType<typeof useQuery<typeof api.cases.queries.list>>>[number];

interface CaseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    caseItem: ConvexCase | null;
}

export function CaseModal({ open, onOpenChange, caseItem }: CaseModalProps) {
    const createCase = useMutation(api.cases.mutations.create);
    const updateCase = useMutation(api.cases.mutations.update);
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];

    const [form, setForm] = useState({
        title: "",
        clientId: "",
        visaType: "",
        status: "Active" as "Active" | "Pending" | "On Hold" | "Completed" | "Rejected",
        assignedTo: "",
        priority: "Medium" as "Low" | "Medium" | "High" | "Urgent",
        notes: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (caseItem) {
            setForm({
                title: caseItem.title,
                clientId: caseItem.clientId,
                visaType: caseItem.visaType,
                status: caseItem.status,
                assignedTo: caseItem.assignedTo,
                priority: caseItem.priority,
                notes: caseItem.notes ?? "",
            });
        } else {
            setForm({ title: "", clientId: "", visaType: "", status: "Active", assignedTo: "", priority: "Medium", notes: "" });
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

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload = {
                title: form.title,
                clientId: form.clientId as Id<"clients">,
                visaType: form.visaType,
                status: form.status,
                assignedTo: form.assignedTo as Id<"users">,
                priority: form.priority,
                notes: form.notes || undefined,
            };
            if (caseItem) {
                await updateCase({ id: caseItem._id, ...payload });
            } else {
                await createCase(payload);
            }
            onOpenChange(false);
        } finally {
            setLoading(false);
        }
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <Label>Visa Type *</Label>
                            <Input value={form.visaType} onChange={(e) => setForm({ ...form, visaType: e.target.value })} placeholder="e.g., H-1B" />
                            {errors.visaType && <p className="text-xs text-destructive">{errors.visaType}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["Active", "Pending", "On Hold", "Completed", "Rejected"].map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Assigned To *</Label>
                            <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    {users.filter((u) => u.status === "active").map((u) => (
                                        <SelectItem key={u._id} value={u._id}>{u.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Priority</Label>
                            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as typeof form.priority })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["Low", "Medium", "High", "Urgent"].map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
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
                    <Button onClick={handleSubmit} disabled={loading}>{caseItem ? "Save Changes" : "Create Case"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
