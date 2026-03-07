"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Plus, Trash2, Zap } from "lucide-react";

type AutomationRule = NonNullable<ReturnType<typeof useQuery<typeof api.automationRules.queries.list>>>[number];

const triggers = [
    "Case Created", "Case Updated", "Task Created", "Task Due Date – 1 day",
    "Task Due Date Passed", "Invoice Created", "Invoice Due Date – 3 days",
    "Invoice Due Date Passed", "Appointment Created", "Appointment – 1 day before",
];
const ruleActions = [
    "Assign to Staff Member", "Send Email Notification", "Send Reminder Email",
    "Update Status", "Create Task", "Send Notification to Assignee",
];

const emptyForm = { name: "", trigger: "", condition: "", action: "" };

export default function AutomationsPage() {
    const rules = useQuery(api.automationRules.queries.list) ?? [];
    const createRule = useMutation(api.automationRules.mutations.create);
    const updateStatus = useMutation(api.automationRules.mutations.updateStatus);
    const removeRule = useMutation(api.automationRules.mutations.remove);

    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: AutomationRule["_id"] | null }>({ open: false, id: null });

    const handleAdd = async () => {
        setSaving(true);
        try {
            await createRule({ ...form });
            setModalOpen(false);
            setForm(emptyForm);
        } finally {
            setSaving(false);
        }
    };

    const toggleRule = (rule: AutomationRule) =>
        updateStatus({ id: rule._id, status: rule.status === "active" ? "inactive" : "active" });

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />Automation Rules
                </CardTitle>
                <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1">
                    <Plus className="h-3.5 w-3.5" />New Rule
                </Button>
            </CardHeader>
            <CardContent>
                {rules.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">
                        No automation rules yet. Create one to get started.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {rules.map((rule) => (
                            <div key={rule._id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium text-sm">{rule.name}</p>
                                        <StatusBadge status={rule.status} />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        When: {rule.trigger} · If: {rule.condition} · Then: {rule.action}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={rule.status === "active"}
                                        onCheckedChange={() => toggleRule(rule)}
                                    />
                                    <Button
                                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => setDeleteDialog({ open: true, id: rule._id })}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader><DialogTitle>New Automation Rule</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Rule Name</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Auto-assign H-1B cases"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Trigger (When)</Label>
                            <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v })}>
                                <SelectTrigger><SelectValue placeholder="Select trigger" /></SelectTrigger>
                                <SelectContent>
                                    {triggers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Condition (If)</Label>
                            <Input
                                value={form.condition}
                                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                                placeholder="e.g. Visa Type = H-1B"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Action (Then)</Label>
                            <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                                <SelectTrigger><SelectValue placeholder="Select action" /></SelectTrigger>
                                <SelectContent>
                                    {ruleActions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleAdd}
                            disabled={saving || !form.name || !form.trigger || !form.action}
                        >
                            Create Rule
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
                title="Delete Rule"
                description="Are you sure you want to delete this automation rule?"
                onConfirm={async () => {
                    if (deleteDialog.id) await removeRule({ id: deleteDialog.id });
                    setDeleteDialog({ open: false, id: null });
                }}
            />
        </Card>
    );
}
