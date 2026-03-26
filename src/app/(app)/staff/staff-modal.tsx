"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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

const DEFAULT_ROLES = [
    { id: "admin",        name: "Admin" },
    { id: "case_manager", name: "Case Manager" },
    { id: "staff",        name: "Staff" },
    { id: "accountant",   name: "Accountant" },
];

export function StaffModal({ open, onOpenChange, staff }: StaffModalProps) {
    const updateMember = useMutation(api.users.mutations.updateMember);
    const currentUser = useQuery(api.users.queries.me);
    const settings = useQuery(api.organisations.queries.getSettings);
    const builtInIds = new Set(DEFAULT_ROLES.map((r) => r.id));
    const orgCustom = (settings?.customRoles ?? []).filter((r) => !builtInIds.has(r.id));
    // Admin is always first; custom roles follow built-ins (excluding admin which is already in DEFAULT_ROLES)
    const allRoles = [...DEFAULT_ROLES, ...orgCustom];

    const [form, setForm] = useState({
        roleId: "staff",
        status: "active" as "active" | "inactive",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const isSelf = staff?._id === (currentUser?._id as Id<"users"> | undefined);

    useEffect(() => {
        if (staff) {
            setError("");
            const roleId = staff.role === "admin" ? "admin" : (staff.roleId ?? staff.role);
            setForm({
                roleId,
                status: staff.status === "pending_onboarding" ? "active" : staff.status,
            });
        }
    }, [staff, open]);

    const handleSubmit = async () => {
        if (!staff) return;
        setLoading(true);
        setError("");
        try {
            await updateMember({ id: staff._id, roleId: form.roleId, status: form.status });
            onOpenChange(false);
        } catch (err: unknown) {
            const convexErr = err as { data?: { message?: string }; message?: string };
            setError(convexErr?.data?.message ?? convexErr?.message ?? "Failed to update member.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent style={{ maxWidth: "600px" }}>
                <DialogHeader>
                    <DialogTitle>Edit Staff Member</DialogTitle>
                </DialogHeader>
                {staff && (
                    <div className="py-2">
                        <p className="text-sm font-medium">{staff.fullName}</p>
                        <p className="text-xs text-muted-foreground mb-4">{staff.email}</p>

                        {isSelf && (
                            <p className="mb-3 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                                You cannot change your own role.
                            </p>
                        )}
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Label>Role</Label>
                                <Select
                                    value={form.roleId}
                                    onValueChange={(v) => setForm({ ...form, roleId: v })}
                                    disabled={isSelf}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {allRoles.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Status</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}
                                    disabled={isSelf}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {error && (
                            <p className="mt-3 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                                {error}
                            </p>
                        )}
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || isSelf}>
                        {loading ? "Saving…" : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
