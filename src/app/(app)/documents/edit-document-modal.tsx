"use client";

import { useState, useEffect } from "react";
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
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ConvexDocument = NonNullable<ReturnType<typeof useQuery<typeof api.documents.queries.list>>>[number];

const docTypes = ["Identity", "Employment", "Immigration", "Education", "Financial", "Supporting"] as const;
type DocType = typeof docTypes[number];

interface EditDocumentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    document: ConvexDocument | null;
}

export function EditDocumentModal({ open, onOpenChange, document }: EditDocumentModalProps) {
    const cases = useQuery(api.cases.queries.listAll) ?? [];
    const updateDocument = useMutation(api.documents.mutations.update);

    const [form, setForm] = useState<{ name: string; type: DocType | ""; caseId: string }>({
        name: "", type: "", caseId: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [casePopoverOpen, setCasePopoverOpen] = useState(false);

    useEffect(() => {
        if (document) {
            setForm({
                name: document.name,
                type: document.type as DocType,
                caseId: document.caseId ?? "",
            });
        }
        setErrors({});
        setCasePopoverOpen(false);
    }, [document, open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = "Document name is required";
        if (!form.type) errs.type = "Type is required";
        if (!form.caseId) errs.caseId = "Case is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate() || !document) return;
        setSaving(true);
        try {
            await updateDocument({
                id: document._id,
                name: form.name.trim(),
                type: form.type as DocType,
                caseId: form.caseId as Id<"cases">,
            });
            onOpenChange(false);
        } catch {
            setErrors((e) => ({ ...e, submit: "Failed to save changes. Please try again." }));
        } finally {
            setSaving(false);
        }
    };

    const selectedCaseTitle = form.caseId
        ? (cases.find((c) => c._id === form.caseId)?.title ?? "Select case")
        : "Select case";

    return (
        <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader><DialogTitle>Edit Document</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
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

                    {errors.submit && <p className="text-xs text-destructive">{errors.submit}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={saving} className="gap-2">
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {saving ? "Saving…" : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
