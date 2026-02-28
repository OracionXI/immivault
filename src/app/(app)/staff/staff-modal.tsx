"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Staff, Status } from "@/lib/types";

interface StaffModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    staff: Staff | null;
    onSave: (s: Staff) => void;
}

const roles = ["Senior Immigration Attorney", "Immigration Attorney", "Case Manager", "Immigration Paralegal", "Junior Paralegal", "Admin Assistant", "Office Manager"];
const departments = ["Legal", "Operations", "Administration", "Finance"];

export function StaffModal({ open, onOpenChange, staff, onSave }: StaffModalProps) {
    const [form, setForm] = useState({ name: "", email: "", role: "", department: "", status: "active" as Status });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (staff) {
            setForm({ name: staff.name, email: staff.email, role: staff.role, department: staff.department, status: staff.status });
        } else {
            setForm({ name: "", email: "", role: "", department: "", status: "active" });
        }
        setErrors({});
    }, [staff, open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = "Name is required";
        if (!form.email.trim()) errs.email = "Email is required";
        if (!form.role) errs.role = "Role is required";
        if (!form.department) errs.department = "Department is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        onSave({ id: staff?.id || "", ...form, joinedAt: staff?.joinedAt || new Date().toISOString().split("T")[0] });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader><DialogTitle>{staff ? "Edit Staff" : "Add Staff Member"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2"><Label>Full Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Sarah Chen" />{errors.name && <p className="text-xs text-destructive">{errors.name}</p>}</div>
                    <div className="grid gap-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@immivault.com" />{errors.email && <p className="text-xs text-destructive">{errors.email}</p>}</div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label>Role *</Label><Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>{errors.role && <p className="text-xs text-destructive">{errors.role}</p>}</div>
                        <div className="grid gap-2"><Label>Department *</Label><Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>{errors.department && <p className="text-xs text-destructive">{errors.department}</p>}</div>
                    </div>
                    <div className="grid gap-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleSubmit}>{staff ? "Save Changes" : "Add Staff"}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
