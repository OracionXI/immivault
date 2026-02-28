"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Client, Status } from "@/lib/types";

interface ClientModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    client: Client | null;
    onSave: (client: Client) => void;
}

const visaTypes = ["H-1B", "F-1", "L-1A", "L-1B", "O-1", "E-2", "EB-1", "EB-2", "EB-3", "B-1/B-2", "J-1", "K-1", "TN"];

export function ClientModal({ open, onOpenChange, client, onSave }: ClientModalProps) {
    const [form, setForm] = useState({
        name: "", email: "", phone: "", nationality: "", visaType: "", status: "active" as Status,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (client) {
            setForm({ name: client.name, email: client.email, phone: client.phone, nationality: client.nationality, visaType: client.visaType, status: client.status });
        } else {
            setForm({ name: "", email: "", phone: "", nationality: "", visaType: "", status: "active" });
        }
        setErrors({});
    }, [client, open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = "Name is required";
        if (!form.email.trim()) errs.email = "Email is required";
        if (!form.phone.trim()) errs.phone = "Phone is required";
        if (!form.nationality.trim()) errs.nationality = "Nationality is required";
        if (!form.visaType) errs.visaType = "Visa type is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        onSave({
            id: client?.id || "",
            ...form,
            createdAt: client?.createdAt || new Date().toISOString().split("T")[0],
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{client ? "Edit Client" : "New Client"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Maria Rodriguez" />
                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">Phone *</Label>
                            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-0100" />
                            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nationality">Nationality *</Label>
                            <Input id="nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="e.g., Mexican" />
                            {errors.nationality && <p className="text-xs text-destructive">{errors.nationality}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="visaType">Visa Type *</Label>
                            <Select value={form.visaType} onValueChange={(v) => setForm({ ...form, visaType: v })}>
                                <SelectTrigger><SelectValue placeholder="Select visa type" /></SelectTrigger>
                                <SelectContent>
                                    {visaTypes.map((v) => (
                                        <SelectItem key={v} value={v}>{v}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.visaType && <p className="text-xs text-destructive">{errors.visaType}</p>}
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>{client ? "Save Changes" : "Create Client"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
