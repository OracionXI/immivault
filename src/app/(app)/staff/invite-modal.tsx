"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

interface InviteModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// "admin" excluded — new invitees can be promoted after joining.
const ROLES = ["case_manager", "staff"] as const;

const ROLE_LABELS: Record<typeof ROLES[number], string> = {
    case_manager: "Case Manager",
    staff: "Staff",
};

export function InviteModal({ open, onOpenChange }: InviteModalProps) {
    const inviteStaff = useAction(api.users.actions.inviteStaff);

    const [form, setForm] = useState({ email: "", role: "staff" as typeof ROLES[number] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const reset = () => {
        setForm({ email: "", role: "staff" });
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
            await inviteStaff({ email: form.email, role: form.role });
            setSuccess(true);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to send invitation.");
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
                            <span className="capitalize">{form.role}</span>.
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
                                    value={form.role}
                                    onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ROLES.map((r) => (
                                            <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
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
                            <Button onClick={handleSubmit} disabled={loading || !form.email}>
                                {loading ? "Sending…" : "Send Invitation"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
