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

type ConvexTask = NonNullable<ReturnType<typeof useQuery<typeof api.tasks.queries.list>>>[number];

interface TaskModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: ConvexTask | null;
}

export function TaskModal({ open, onOpenChange, task }: TaskModalProps) {
    const createTask = useMutation(api.tasks.mutations.create);
    const updateTask = useMutation(api.tasks.mutations.update);
    const users = useQuery(api.users.queries.listByOrg) ?? [];
    const cases = useQuery(api.cases.queries.listAll) ?? [];

    const [form, setForm] = useState({
        title: "",
        description: "",
        assignedTo: "",
        priority: "Medium" as "Low" | "Medium" | "High" | "Urgent",
        status: "To Do" as "To Do" | "In Progress" | "In Review" | "Completed",
        dueDate: "",
        caseId: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [casePopoverOpen, setCasePopoverOpen] = useState(false);

    useEffect(() => {
        if (task) {
            setForm({
                title: task.title,
                description: task.description ?? "",
                assignedTo: task.assignedTo,
                priority: task.priority,
                status: task.status,
                dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
                caseId: task.caseId ?? "",
            });
        } else {
            setForm({ title: "", description: "", assignedTo: "", priority: "Medium", status: "To Do", dueDate: "", caseId: "" });
        }
        setErrors({});
        setCasePopoverOpen(false);
    }, [task, open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.title.trim()) errs.title = "Title is required";
        if (!form.assignedTo) errs.assignedTo = "Assignee is required";
        if (!form.dueDate) errs.dueDate = "Due date is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const payload = {
                title: form.title,
                description: form.description || undefined,
                assignedTo: form.assignedTo as Id<"users">,
                priority: form.priority,
                status: form.status,
                dueDate: form.dueDate ? new Date(form.dueDate).getTime() : undefined,
                caseId: form.caseId ? (form.caseId as Id<"cases">) : undefined,
            };
            if (task) {
                await updateTask({ id: task._id, ...payload });
            } else {
                await createTask(payload);
            }
            onOpenChange(false);
        } finally {
            setLoading(false);
        }
    };

    const selectedCaseTitle = form.caseId
        ? (cases.find((c) => c._id === form.caseId)?.title ?? "None")
        : "None";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Task Title *</Label>
                        <Input
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="e.g., Collect employment verification"
                        />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>

                    <div className="grid gap-2">
                        <Label>Description</Label>
                        <Textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder="Task details..."
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Assignee *</Label>
                            <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    {users.filter((u) => u.status === "active").map((u) => (
                                        <SelectItem key={u._id} value={u._id}>{u.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Due Date *</Label>
                            <Input
                                type="date"
                                value={form.dueDate}
                                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                            />
                            {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["To Do", "In Progress", "In Review", "Completed"].map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Related Case</Label>
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
                            <PopoverContent className="w-[452px] p-0" align="start" side="bottom">
                                <Command>
                                    <CommandInput placeholder="Search cases..." />
                                    <CommandList>
                                        <CommandEmpty>No cases found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="none"
                                                onSelect={() => { setForm({ ...form, caseId: "" }); setCasePopoverOpen(false); }}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4 shrink-0", form.caseId === "" ? "opacity-100" : "opacity-0")} />
                                                None
                                            </CommandItem>
                                            {cases.map((c) => (
                                                <CommandItem
                                                    key={c._id}
                                                    value={c.title}
                                                    onSelect={() => { setForm({ ...form, caseId: c._id }); setCasePopoverOpen(false); }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4 shrink-0", form.caseId === c._id ? "opacity-100" : "opacity-0")} />
                                                    {c.title}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>{task ? "Save Changes" : "Create Task"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
