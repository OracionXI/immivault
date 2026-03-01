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
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ConvexClient = NonNullable<ReturnType<typeof useQuery<typeof api.clients.queries.list>>>[number];

interface ClientModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    client: ConvexClient | null;
}

export function ClientModal({ open, onOpenChange, client }: ClientModalProps) {
    const createClient = useMutation(api.clients.mutations.create);
    const updateClient = useMutation(api.clients.mutations.update);
    const staff = useQuery(api.users.queries.listByOrg) ?? [];

    const [form, setForm] = useState({
        firstName: "", lastName: "", email: "", phone: "", nationality: "",
        status: "Active" as "Active" | "Pending" | "Inactive" | "Archived",
        assignedTo: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (client) {
            setForm({
                firstName: client.firstName,
                lastName: client.lastName,
                email: client.email,
                phone: client.phone ?? "",
                nationality: client.nationality ?? "",
                status: client.status,
                assignedTo: client.assignedTo,
            });
        } else {
            setForm({ firstName: "", lastName: "", email: "", phone: "", nationality: "", status: "Active", assignedTo: "" });
        }
        setErrors({});
    }, [client, open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.firstName.trim()) errs.firstName = "First name is required";
        if (!form.lastName.trim()) errs.lastName = "Last name is required";
        if (!form.email.trim()) errs.email = "Email is required";
        if (!form.assignedTo) errs.assignedTo = "Assigned staff is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload = {
                firstName: form.firstName,
                lastName: form.lastName,
                email: form.email,
                phone: form.phone || undefined,
                nationality: form.nationality || undefined,
                status: form.status,
                assignedTo: form.assignedTo as Id<"users">,
            };
            if (client) {
                await updateClient({ id: client._id, ...payload });
            } else {
                await createClient(payload);
            }
            onOpenChange(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{client ? "Edit Client" : "New Client"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="firstName">First Name *</Label>
                            <Input id="firstName" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Maria" />
                            {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="lastName">Last Name *</Label>
                            <Input id="lastName" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Rodriguez" />
                            {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-0100" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nationality">Nationality</Label>
                            <Input id="nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="e.g., Mexican" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="status">Status</Label>
                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                    <SelectItem value="Archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Assigned To *</Label>
                        <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                            <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                            <SelectContent>
                                {staff.filter((s) => s.status === "active").map((s) => (
                                    <SelectItem key={s._id} value={s._id}>{s.fullName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo}</p>}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {client ? "Save Changes" : "Create Client"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
