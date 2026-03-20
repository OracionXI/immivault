"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Mail, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { SettingsCardSkeleton } from "@/components/shared/settings-card-skeleton";

type EmailTemplate = NonNullable<ReturnType<typeof useQuery<typeof api.emailTemplates.queries.list>>>[number];

const emptyForm = { name: "", subject: "", body: "", category: "" };

export default function EmailTemplatesPage() {
    const rawTemplates = useQuery(api.emailTemplates.queries.list);
    const templates = rawTemplates ?? [];
    const createTemplate = useMutation(api.emailTemplates.mutations.create);
    const updateTemplate = useMutation(api.emailTemplates.mutations.update);
    const removeTemplate = useMutation(api.emailTemplates.mutations.remove);

    const [editing, setEditing] = useState<EmailTemplate | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: EmailTemplate["_id"] | null }>({ open: false, id: null });

    const openEdit = (t: EmailTemplate) => {
        setEditing(t);
        setCreating(false);
        setForm({ name: t.name, subject: t.subject, body: t.body, category: t.category });
    };

    const openCreate = () => {
        setEditing(null);
        setCreating(true);
        setForm(emptyForm);
    };

    const closeModal = () => {
        setEditing(null);
        setCreating(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editing) {
                await updateTemplate({ id: editing._id, ...form });
            } else {
                await createTemplate(form);
            }
            closeModal();
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const modalOpen = !!editing || creating;

    if (rawTemplates === undefined) return <SettingsCardSkeleton rows={4} />;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />Email Templates
                </CardTitle>
                <Button size="sm" onClick={openCreate} className="gap-1">
                    <Plus className="h-3.5 w-3.5" />New Template
                </Button>
            </CardHeader>
            <CardContent>
                {templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">
                        No email templates yet. Create one to get started.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {templates.map((t) => (
                            <div
                                key={t._id}
                                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                            >
                                <div>
                                    <p className="font-medium text-sm">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.subject}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t.category}</p>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => setDeleteDialog({ open: true, id: t._id })}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
                <DialogContent style={{ maxWidth: "825px" }}>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Email Template" : "New Email Template"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Template Name</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. Invoice Sent"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Category</Label>
                                <Input
                                    value={form.category}
                                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    placeholder="e.g. Billing"
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Subject Line</Label>
                            <Input
                                value={form.subject}
                                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                placeholder="e.g. Your invoice #{invoice_number} is ready"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Body</Label>
                            <Textarea
                                value={form.body}
                                onChange={(e) => setForm({ ...form, body: e.target.value })}
                                rows={8}
                                className="font-mono text-sm"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Available variables: {"{client_name}"}, {"{case_title}"}, {"{invoice_number}"}, {"{date}"}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeModal}>Cancel</Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !form.name || !form.subject}
                            className="gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {editing ? "Save Template" : "Create Template"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
                title="Delete Template"
                description="Are you sure you want to delete this email template?"
                onConfirm={async () => {
                    if (deleteDialog.id) await removeTemplate({ id: deleteDialog.id });
                    setDeleteDialog({ open: false, id: null });
                }}
            />
        </Card>
    );
}
