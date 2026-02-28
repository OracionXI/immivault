"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { mockAutomationRules } from "@/lib/mock-data";
import type { AutomationRule } from "@/lib/types";
import { Plus, Trash2, Zap } from "lucide-react";

const triggers = ["Case Created", "Case Updated", "Task Created", "Task Due Date – 1 day", "Task Due Date Passed", "Invoice Created", "Invoice Due Date – 3 days", "Invoice Due Date Passed", "Appointment Created", "Appointment – 1 day before"];
const actions = ["Assign to Staff Member", "Send Email Notification", "Send Reminder Email", "Update Status", "Create Task", "Send Notification to Assignee"];

export default function AutomationsPage() {
    const [rules, setRules] = useState<AutomationRule[]>(mockAutomationRules);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ name: "", trigger: "", condition: "", action: "" });
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

    const handleAdd = () => {
        setRules([...rules, { id: `ar${Date.now()}`, ...form, status: "active", createdAt: new Date().toISOString().split("T")[0] }]);
        setModalOpen(false);
        setForm({ name: "", trigger: "", condition: "", action: "" });
    };

    const toggleRule = (id: string) => {
        setRules((prev) => prev.map((r) => (r.id === id ? { ...r, status: r.status === "active" ? "inactive" : "active" } : r)));
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Automation Rules</CardTitle>
                <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1"><Plus className="h-3.5 w-3.5" />New Rule</Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {rules.map((rule) => (
                        <div key={rule.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
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
                                <Switch checked={rule.status === "active"} onCheckedChange={() => toggleRule(rule.id)} />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, id: rule.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader><DialogTitle>New Automation Rule</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>Rule Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Auto-assign H-1B cases" /></div>
                        <div className="grid gap-2">
                            <Label>Trigger (When)</Label>
                            <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v })}>
                                <SelectTrigger><SelectValue placeholder="Select trigger" /></SelectTrigger>
                                <SelectContent>{triggers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2"><Label>Condition (If)</Label><Input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="e.g., Visa Type = H-1B" /></div>
                        <div className="grid gap-2">
                            <Label>Action (Then)</Label>
                            <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                                <SelectTrigger><SelectValue placeholder="Select action" /></SelectTrigger>
                                <SelectContent>{actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleAdd}>Create Rule</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })} title="Delete Rule" description="Are you sure you want to delete this automation rule?" onConfirm={() => { if (deleteDialog.id) setRules((prev) => prev.filter((r) => r.id !== deleteDialog.id)); setDeleteDialog({ open: false, id: null }); }} />
        </Card>
    );
}
