"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Upload, File, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const docTypes = ["Identity", "Employment", "Immigration", "Education", "Financial", "Supporting"] as const;
type DocType = typeof docTypes[number];

const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|jpg|jpeg|png)$/i;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function UploadModal({ open, onOpenChange }: UploadModalProps) {
    // listAll is RBAC-scoped: case managers only see their assigned cases
    const cases = useQuery(api.cases.queries.listAll) ?? [];
    const generateUploadUrl = useMutation(api.documents.mutations.generateUploadUrl);
    const createDocument = useMutation(api.documents.mutations.create);

    const [form, setForm] = useState<{ name: string; type: DocType | ""; caseId: string }>({
        name: "", type: "", caseId: "",
    });
    const [file, setFile] = useState<File | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [casePopoverOpen, setCasePopoverOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setForm({ name: "", type: "", caseId: "" });
            setFile(null);
            setErrors({});
            setUploading(false);
            setIsDragging(false);
            setCasePopoverOpen(false);
        }
    }, [open]);

    const acceptFile = (f: File) => {
        if (!ALLOWED_EXTENSIONS.test(f.name)) {
            setErrors((e) => ({ ...e, file: "Only PDF, DOC, JPG, PNG files are allowed." }));
            return;
        }
        if (f.size > MAX_FILE_SIZE) {
            setErrors((e) => ({ ...e, file: "File must be 10 MB or smaller." }));
            return;
        }
        setFile(f);
        if (!form.name) {
            setForm((prev) => ({ ...prev, name: f.name.replace(/\.[^.]+$/, "") }));
        }
        setErrors((e) => { const { file: _, ...rest } = e; return rest; });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) acceptFile(f);
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = "Document name is required";
        if (!form.type) errs.type = "Type is required";
        if (!form.caseId) errs.caseId = "Case is required";
        if (!file) errs.file = "File is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate() || !file) return;
        setUploading(true);
        try {
            const uploadUrl = await generateUploadUrl();
            const result = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": file.type || "application/octet-stream" },
                body: file,
            });
            if (!result.ok) throw new Error("Storage upload failed");
            const { storageId } = await result.json() as { storageId: Id<"_storage"> };

            await createDocument({
                caseId: form.caseId as Id<"cases">,
                name: form.name.trim(),
                type: form.type as DocType,
                storageId,
                fileSize: file.size,
                mimeType: file.type || "application/octet-stream",
            });

            onOpenChange(false);
        } catch {
            setErrors((e) => ({ ...e, file: "Upload failed. Please try again." }));
        } finally {
            setUploading(false);
        }
    };

    const selectedCaseTitle = form.caseId
        ? (cases.find((c) => c._id === form.caseId)?.title ?? "Select case")
        : "Select case";

    return (
        <Dialog open={open} onOpenChange={uploading ? undefined : onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* File drop zone */}
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
                        />
                        {file ? (
                            <div className="flex items-center justify-center gap-2">
                                <File className="h-5 w-5 text-primary flex-shrink-0" />
                                <span className="text-sm font-medium truncate max-w-[280px]">{file.name}</span>
                                <button
                                    className="ml-1 text-muted-foreground hover:text-foreground flex-shrink-0"
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">Click to upload or drag &amp; drop</p>
                                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, JPG, PNG up to 10 MB</p>
                            </>
                        )}
                    </div>
                    {errors.file && <p className="text-xs text-destructive">{errors.file}</p>}

                    <div className="grid gap-2">
                        <Label>Document Name *</Label>
                        <Input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Passport – John Doe"
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Document Type *</Label>
                            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as DocType })}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                    {docTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Case *</Label>
                            <Popover open={casePopoverOpen} onOpenChange={setCasePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={casePopoverOpen}
                                        className="w-full justify-between font-normal truncate"
                                    >
                                        <span className="truncate">{selectedCaseTitle}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[220px] p-0" align="start" side="bottom">
                                    <Command>
                                        <CommandInput placeholder="Search cases..." />
                                        <CommandList>
                                            <CommandEmpty>No cases found.</CommandEmpty>
                                            <CommandGroup>
                                                {cases.map((c) => (
                                                    <CommandItem
                                                        key={c._id}
                                                        value={c.title}
                                                        onSelect={() => { setForm({ ...form, caseId: c._id }); setCasePopoverOpen(false); }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4 shrink-0", form.caseId === c._id ? "opacity-100" : "opacity-0")} />
                                                        <span className="truncate">{c.title}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {errors.caseId && <p className="text-xs text-destructive">{errors.caseId}</p>}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={uploading} className="gap-2">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? "Uploading…" : "Upload"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
