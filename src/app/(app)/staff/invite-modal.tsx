"use client";

import { useState, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";
import { CheckCircle2 } from "lucide-react";

interface InviteModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const DEFAULT_ROLES = [
    { id: "case_manager", name: "Case Manager" },
    { id: "staff",        name: "Staff" },
];

export function InviteModal({ open, onOpenChange }: InviteModalProps) {
    const inviteStaff = useAction(api.users.actions.inviteStaff);
    const settings = useQuery(api.organisations.queries.getSettings);
    const customRoles = settings?.customRoles ?? DEFAULT_ROLES;

    const defaultRoleId = customRoles[0]?.id ?? "staff";

    const [form, setForm] = useState({ email: "", roleId: defaultRoleId });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // Keep default in sync if roles load after mount
    useEffect(() => {
        if (customRoles.length > 0 && !customRoles.find((r) => r.id === form.roleId)) {
            setForm((prev) => ({ ...prev, roleId: customRoles[0].id }));
        }
    }, [customRoles, form.roleId]);

    const selectedRole = customRoles.find((r) => r.id === form.roleId);

    const reset = () => {
        setForm({ email: "", roleId: customRoles[0]?.id ?? "staff" });
        setError("");
        setSuccess(false);
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) reset();
        onOpenChange(open);
    };

    const handleSubmit = async () => {
        setError("");
        setLoading(true);
        try {
            await inviteStaff({ email: form.email, roleId: form.roleId });
            setSuccess(true);
        } catch (e: unknown) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>Invite Staff Member</DialogTitle>
                </DialogHeader>

                {success ? (
                    <div className="py-8 flex flex-col items-center gap-3 text-center">
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                        <p className="font-medium">Invitation sent!</p>
                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium">{form.email}</span> will receive an email
                            invitation to join your organisation as{" "}
                            <span className="font-medium">{selectedRole?.name ?? form.roleId}</span>.
                        </p>
                        <Button className="mt-2" onClick={() => handleOpenChange(false)}>Done</Button>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="invite-email">Email Address</Label>
                                <Input
                                    id="invite-email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="colleague@example.com"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Role</Label>
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
                            </div>
                            {error && (
                                <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                                    {error}
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                            <Button onClick={handleSubmit} disabled={loading || !form.email || customRoles.length === 0}>
                                {loading ? "Sending…" : "Send Invitation"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
