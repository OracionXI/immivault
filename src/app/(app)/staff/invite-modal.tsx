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
import { CheckCircle2, Copy, Check } from "lucide-react";

interface InviteModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const DEFAULT_ROLES = [
    { id: "case_manager", name: "Case Manager" },
    { id: "staff",        name: "Staff" },
    { id: "accountant",   name: "Accountant" },
];

export function InviteModal({ open, onOpenChange }: InviteModalProps) {
    const inviteStaff = useAction(api.users.actions.inviteStaff);
    const settings = useQuery(api.organisations.queries.getSettings);
    const builtInIds = new Set(DEFAULT_ROLES.map((r) => r.id));
    const orgCustom = (settings?.customRoles ?? []).filter((r) => !builtInIds.has(r.id));
    const customRoles = [...DEFAULT_ROLES, ...orgCustom];

    const defaultRoleId = customRoles[0]?.id ?? "staff";

    const [form, setForm] = useState({ email: "", roleId: defaultRoleId });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

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
        setInviteUrl(null);
        setCopied(false);
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) reset();
        onOpenChange(open);
    };

    const handleSubmit = async () => {
        setError("");
        setLoading(true);
        try {
            const result = await inviteStaff({
                email: form.email,
                roleId: form.roleId,
                redirectUrl: typeof window !== "undefined" ? `${window.location.origin}/invite` : undefined,
            });
            setInviteUrl(result?.inviteUrl ?? null);
            setSuccess(true);
        } catch (e: unknown) {
            setError(getErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!inviteUrl) return;
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent style={{ maxWidth: "630px" }}>
                <DialogHeader>
                    <DialogTitle>Invite Staff Member</DialogTitle>
                </DialogHeader>

                {success ? (
                    <div className="py-6 flex flex-col items-center gap-3 text-center">
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                        <p className="font-medium">Invitation sent!</p>
                        <p className="text-sm text-muted-foreground">
                            An invitation email was sent to{" "}
                            <span className="font-medium">{form.email}</span> as{" "}
                            <span className="font-medium">{selectedRole?.name ?? form.roleId}</span>.
                        </p>

                        {inviteUrl && (
                            <div className="w-full mt-1 rounded-lg border bg-muted/50 p-3 text-left">
                                <p className="text-xs text-muted-foreground mb-2">
                                    Didn&apos;t receive the email? Share this link directly:
                                </p>
                                <div className="flex items-center gap-2">
                                    <p className="flex-1 text-xs font-mono break-all text-foreground line-clamp-2">
                                        {inviteUrl}
                                    </p>
                                    <button
                                        onClick={handleCopy}
                                        className="shrink-0 rounded-md p-1.5 hover:bg-accent transition-colors"
                                        title="Copy link"
                                    >
                                        {copied
                                            ? <Check className="h-3.5 w-3.5 text-green-500" />
                                            : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <Button className="mt-1" onClick={() => handleOpenChange(false)}>Done</Button>
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
