"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type ConvexCase = NonNullable<ReturnType<typeof useQuery<typeof api.cases.queries.list>>>[number];

interface CaseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    caseItem: ConvexCase | null;
}

export function CaseModal({ open, onOpenChange, caseItem }: CaseModalProps) {
    const createCase = useMutation(api.cases.mutations.create);
    const updateCase = useMutation(api.cases.mutations.update);
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];

    // Cases can only be assigned to case managers
    const caseManagers = users.filter((u) => u.role === "case_manager" && u.status === "active");

    const [form, setForm] = useState({
        title: "",
        clientId: "",
        visaType: "",
        status: "Active" as "Active" | "Pending" | "On Hold" | "Completed" | "Rejected" | "Archived",
        assignedTo: "",
        priority: "Medium" as "Low" | "Medium" | "High" | "Urgent",
        notes: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

    useEffect(() => {
        if (caseItem) {
            setForm({
                title: caseItem.title,
                clientId: caseItem.clientId,
                visaType: caseItem.visaType,
                status: caseItem.status,
                assignedTo: caseItem.assignedTo ?? "",
                priority: caseItem.priority,
                notes: caseItem.notes ?? "",
            });
        } else {
            setForm({ title: "", clientId: "", visaType: "", status: "Active", assignedTo: "", priority: "Medium", notes: "" });
        }
        setErrors({});
        setAssigneePopoverOpen(false);
    }, [caseItem, open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.title.trim()) errs.title = "Title is required";
        if (!form.clientId) errs.clientId = "Client is required";
        if (!form.visaType.trim()) errs.visaType = "Visa type is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const assignedToId = form.assignedTo ? (form.assignedTo as Id<"users">) : undefined;
            if (caseItem) {
                // null signals "clear the assignee"; undefined means "leave unchanged"
                await updateCase({
                    id: caseItem._id,
                    title: form.title,
                    clientId: form.clientId as Id<"clients">,
                    visaType: form.visaType,
                    status: form.status,
                    assignedTo: assignedToId ?? null,
                    priority: form.priority,
                    notes: form.notes || undefined,
                });
            } else {
                await createCase({
                    title: form.title,
                    clientId: form.clientId as Id<"clients">,
                    visaType: form.visaType,
                    status: form.status,
                    assignedTo: assignedToId,
                    priority: form.priority,
                    notes: form.notes || undefined,
                });
            }
            onOpenChange(false);
        } finally {
            setLoading(false);
        }
    };

    const selectedManagerName = form.assignedTo
        ? (caseManagers.find((u) => u._id === form.assignedTo)?.fullName ?? "Unassigned")
        : "Unassigned";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader><DialogTitle>{caseItem ? "Edit Case" : "New Case"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Case Title *</Label>
                        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., H-1B Petition – John Doe" />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Client *</Label>
                            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                <SelectContent>
                                    {clients.map((c) => (
                                        <SelectItem key={c._id} value={c._id}>{c.firstName} {c.lastName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Visa Type *</Label>
                            <Input value={form.visaType} onChange={(e) => setForm({ ...form, visaType: e.target.value })} placeholder="e.g., H-1B" />
                            {errors.visaType && <p className="text-xs text-destructive">{errors.visaType}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["Active", "Pending", "On Hold", "Completed", "Rejected"].map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Assigned To</Label>
                            <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={assigneePopoverOpen}
                                        className="w-full justify-between font-normal truncate"
                                    >
                                        <span className="truncate">{selectedManagerName}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0" align="start" side="bottom">
                                    <Command>
                                        <CommandInput placeholder="Search case managers..." />
                                        <CommandList>
                                            <CommandEmpty>No case managers found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="unassigned"
                                                    onSelect={() => { setForm({ ...form, assignedTo: "" }); setAssigneePopoverOpen(false); }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4 shrink-0", form.assignedTo === "" ? "opacity-100" : "opacity-0")} />
                                                    Unassigned
                                                </CommandItem>
                                                {caseManagers.map((u) => (
                                                    <CommandItem
                                                        key={u._id}
                                                        value={u.fullName}
                                                        onSelect={() => { setForm({ ...form, assignedTo: u._id }); setAssigneePopoverOpen(false); }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4 shrink-0", form.assignedTo === u._id ? "opacity-100" : "opacity-0")} />
                                                        {u.fullName}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid gap-2">
                            <Label>Priority</Label>
                            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as typeof form.priority })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["Low", "Medium", "High", "Urgent"].map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={3} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>{caseItem ? "Save Changes" : "Create Case"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
