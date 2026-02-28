"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { mockEmailTemplates } from "@/lib/mock-data";
import type { EmailTemplate } from "@/lib/types";
import { Mail, Pencil, Save } from "lucide-react";

export default function EmailTemplatesPage() {
    const [templates, setTemplates] = useState<EmailTemplate[]>(mockEmailTemplates);
    const [editing, setEditing] = useState<EmailTemplate | null>(null);
    const [form, setForm] = useState({ name: "", subject: "", body: "", category: "" });

    const openEdit = (t: EmailTemplate) => {
        setEditing(t);
        setForm({ name: t.name, subject: t.subject, body: t.body, category: t.category });
    };

    const handleSave = () => {
        if (editing) {
            setTemplates((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...form, updatedAt: new Date().toISOString().split("T")[0] } : t)));
            setEditing(null);
        }
    };

    return (
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Email Templates</CardTitle></CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {templates.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                            <div>
                                <p className="font-medium text-sm">{t.name}</p>
                                <p className="text-xs text-muted-foreground">{t.subject}</p>
                                <p className="text-xs text-muted-foreground mt-1">{t.category} · Updated: {t.updatedAt}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                        </div>
                    ))}
                </div>
            </CardContent>

            <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader><DialogTitle>Edit Email Template</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>Template Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                            <div className="grid gap-2"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                        </div>
                        <div className="grid gap-2"><Label>Subject Line</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                        <div className="grid gap-2"><Label>Body</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} className="font-mono text-sm" /></div>
                        <p className="text-xs text-muted-foreground">Available variables: {"{client_name}"}, {"{case_title}"}, {"{invoice_number}"}, {"{date}"}</p>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" />Save Template</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
