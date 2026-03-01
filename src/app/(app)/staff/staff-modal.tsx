"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ConvexUser = NonNullable<ReturnType<typeof useQuery<typeof api.users.queries.listByOrg>>>[number];

interface StaffModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    staff: ConvexUser | null;
}

const ROLES = ["admin", "attorney", "paralegal", "staff"] as const;

export function StaffModal({ open, onOpenChange, staff }: StaffModalProps) {
    const updateMember = useMutation(api.users.mutations.updateMember);

    const [form, setForm] = useState({
        role: "staff" as typeof ROLES[number],
        status: "active" as "active" | "inactive",
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (staff) {
            setForm({ role: staff.role, status: staff.status });
        }
    }, [staff, open]);

    const handleSubmit = async () => {
        if (!staff) return;
        setLoading(true);
        try {
            await updateMember({ id: staff._id, role: form.role, status: form.status });
            onOpenChange(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Edit Staff Member</DialogTitle>
                </DialogHeader>
                {staff && (
                    <div className="py-2">
                        <p className="text-sm font-medium">{staff.fullName}</p>
                        <p className="text-xs text-muted-foreground mb-4">{staff.email}</p>

                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label>Role</Label>
                                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ROLES.map((r) => (
                                            <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Status</Label>
                                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
