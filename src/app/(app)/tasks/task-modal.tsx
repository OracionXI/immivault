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

    // Tasks can be assigned to case managers or staff — never admins
    const assignableUsers = users.filter(
        (u) => (u.role === "case_manager" || u.role === "staff") && u.status === "active"
    );

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
    const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);
    const [casePopoverOpen, setCasePopoverOpen] = useState(false);

    useEffect(() => {
        if (task) {
            setForm({
                title: task.title,
                description: task.description ?? "",
                assignedTo: task.assignedTo ? (task.assignedTo as string) : "",
                priority: task.priority,
                status: task.status,
                dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
                caseId: task.caseId ?? "",
            });
        } else {
            setForm({ title: "", description: "", assignedTo: "", priority: "Medium", status: "To Do", dueDate: "", caseId: "" });
        }
        setErrors({});
        setAssigneePopoverOpen(false);
        setCasePopoverOpen(false);
    }, [task, open]);

    const today = new Date().toISOString().split("T")[0];

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.title.trim()) errs.title = "Title is required";
        if (!form.caseId) errs.caseId = "Related case is required";
        if (!form.dueDate) {
            errs.dueDate = "Due date is required";
        } else if (!task && form.dueDate < today) {
            errs.dueDate = "Due date cannot be in the past";
        }
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
                assignedTo: form.assignedTo ? (form.assignedTo as Id<"users">) : undefined,
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
                            <Label>Assignee</Label>
                            <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={assigneePopoverOpen}
                                        className="w-full justify-between font-normal truncate"
                                    >
                                        <span className="truncate">
                                            {form.assignedTo
                                                ? (assignableUsers.find((u) => u._id === form.assignedTo)?.fullName ?? "Unassigned")
                                                : "Unassigned"}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0" align="start" side="bottom">
                                    <Command>
                                        <CommandInput placeholder="Search..." />
                                        <CommandList>
                                            <CommandEmpty>No users found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem
                                                    value="unassigned"
                                                    onSelect={() => { setForm({ ...form, assignedTo: "" }); setAssigneePopoverOpen(false); }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4 shrink-0", form.assignedTo === "" ? "opacity-100" : "opacity-0")} />
                                                    Unassigned
                                                </CommandItem>
                                                {assignableUsers.map((u) => (
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
                            <Label>Due Date *</Label>
                            <Input
                                type="date"
                                value={form.dueDate}
                                min={today}
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
                        <Label>Related Case *</Label>
                        <Popover open={casePopoverOpen} onOpenChange={setCasePopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={casePopoverOpen}
                                    className={cn(
                                        "w-full justify-between font-normal truncate",
                                        errors.caseId && "border-destructive"
                                    )}
                                >
                                    <span className={cn("truncate", !form.caseId && "text-muted-foreground")}>
                                        {form.caseId
                                            ? (cases.find((c) => c._id === form.caseId)?.title ?? "Select a case")
                                            : "Select a case"}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[452px] p-0" align="start" side="bottom">
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
                                                    {c.title}
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
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>{task ? "Save Changes" : "Create Task"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
