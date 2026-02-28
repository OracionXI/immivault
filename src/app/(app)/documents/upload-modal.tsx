"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Document } from "@/lib/types";
import { mockClients } from "@/lib/mock-data";
import { Upload, File } from "lucide-react";

interface UploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (doc: Document) => void;
}

const docTypes = ["Identity", "Employment", "Immigration", "Education", "Financial", "Business", "Supporting", "Other"];

export function UploadModal({ open, onOpenChange, onSave }: UploadModalProps) {
    const [form, setForm] = useState({ name: "", type: "", clientId: "", expiryDate: "" });
    const [fileName, setFileName] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) { setForm({ name: "", type: "", clientId: "", expiryDate: "" }); setFileName(""); setErrors({}); }
    }, [open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = "Document name is required";
        if (!form.type) errs.type = "Type is required";
        if (!form.clientId) errs.clientId = "Client is required";
        if (!fileName) errs.file = "File is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        const client = mockClients.find((c) => c.id === form.clientId);
        onSave({
            id: "", name: form.name, type: form.type, clientId: form.clientId,
            clientName: client?.name || "", status: "active",
            uploadedAt: new Date().toISOString().split("T")[0],
            expiryDate: form.expiryDate || undefined, fileSize: "1.2 MB",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* File drop zone */}
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                        onClick={() => { setFileName("document_upload.pdf"); }}>
                        {fileName ? (
                            <div className="flex items-center justify-center gap-2"><File className="h-5 w-5 text-primary" /><span className="text-sm font-medium">{fileName}</span></div>
                        ) : (
                            <><Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Click to upload or drag & drop</p><p className="text-xs text-muted-foreground mt-1">PDF, DOC, JPG, PNG up to 10MB</p></>
                        )}
                    </div>
                    {errors.file && <p className="text-xs text-destructive">{errors.file}</p>}
                    <div className="grid gap-2">
                        <Label>Document Name *</Label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Passport – John Doe" />
                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Document Type *</Label>
                            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>{docTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                            {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Client *</Label>
                            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                <SelectContent>{mockClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Expiry Date (optional)</Label>
                        <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>Upload</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
