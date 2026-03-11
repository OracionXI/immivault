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

const DEFAULT_ROLES = [
    { id: "case_manager", name: "Case Manager" },
    { id: "staff",        name: "Staff" },
];

export function StaffModal({ open, onOpenChange, staff }: StaffModalProps) {
    const updateMember = useMutation(api.users.mutations.updateMember);
    const settings = useQuery(api.organisations.queries.getSettings);
    const customRoles = settings?.customRoles ?? DEFAULT_ROLES;

    const [form, setForm] = useState({
        roleId: "staff",
        status: "active" as "active" | "inactive",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const isAdmin = staff?.role === "admin";

    useEffect(() => {
        if (staff) {
            setError("");
            // Use stored roleId if available; otherwise fall back to role (permission tier)
            const roleId = staff.roleId ?? (staff.role !== "admin" ? staff.role : "staff");
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
                                {isAdmin ? (
                                    <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                                        Admin <span className="ml-2 text-xs">(cannot be changed)</span>
                                    </div>
                                ) : (
                                    <Select
                                        value={form.roleId}
                                        onValueChange={(v) => setForm({ ...form, roleId: v })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {customRoles.map((r) => (
                                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label>Status</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}
                                    disabled={isAdmin}
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
                    <Button onClick={handleSubmit} disabled={loading || isAdmin}>
                        {loading ? "Saving…" : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
