"use client";

import { useState, useEffect } from "react";
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
import type { Task, TaskStatus, Priority } from "@/lib/types";
import { mockStaff, mockCases } from "@/lib/mock-data";

interface TaskModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: Task | null;
    onSave: (t: Task) => void;
}

export function TaskModal({ open, onOpenChange, task, onSave }: TaskModalProps) {
    const [form, setForm] = useState({
        title: "",
        description: "",
        assignee: "",
        priority: "Medium" as Priority,
        status: "To Do" as TaskStatus,
        dueDate: "",
        caseId: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [casePopoverOpen, setCasePopoverOpen] = useState(false);

    useEffect(() => {
        if (task) {
            setForm({
                title: task.title,
                description: task.description,
                assignee: task.assignee,
                priority: task.priority,
                status: task.status,
                dueDate: task.dueDate,
                caseId: task.caseId || "",
            });
        } else {
            setForm({ title: "", description: "", assignee: "", priority: "Medium", status: "To Do", dueDate: "", caseId: "" });
        }
        setErrors({});
        setCasePopoverOpen(false);
    }, [task, open]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.title.trim()) errs.title = "Title is required";
        if (!form.assignee) errs.assignee = "Assignee is required";
        if (!form.dueDate) errs.dueDate = "Due date is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        const relatedCase = mockCases.find((c) => c.id === form.caseId);
        onSave({
            id: task?.id || "",
            ...form,
            caseName: relatedCase?.title,
            createdAt: task?.createdAt || new Date().toISOString().split("T")[0],
        });
    };

    const selectedCaseTitle = form.caseId
        ? mockCases.find((c) => c.id === form.caseId)?.title ?? "None"
        : "None";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Title */}
                    <div className="grid gap-2">
                        <Label>Task Title *</Label>
                        <Input
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="e.g., Collect employment verification"
                        />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>

                    {/* Description */}
                    <div className="grid gap-2">
                        <Label>Description</Label>
                        <Textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            placeholder="Task details..."
                            rows={3}
                        />
                    </div>

                    {/* Assignee + Due Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Assignee *</Label>
                            <Select value={form.assignee} onValueChange={(v) => setForm({ ...form, assignee: v })}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    {mockStaff.filter((s) => s.status === "active").map((s) => (
                                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.assignee && <p className="text-xs text-destructive">{errors.assignee}</p>}
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

                    {/* Priority + Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Priority</Label>
                            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
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
                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["To Do", "In Progress", "Review", "Done"].map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Related Case — searchable combobox, full width */}
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
                                                onSelect={() => {
                                                    setForm({ ...form, caseId: "" });
                                                    setCasePopoverOpen(false);
                                                }}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4 shrink-0", form.caseId === "" ? "opacity-100" : "opacity-0")} />
                                                None
                                            </CommandItem>
                                            {mockCases.map((c) => (
                                                <CommandItem
                                                    key={c.id}
                                                    value={c.title}
                                                    onSelect={() => {
                                                        setForm({ ...form, caseId: c.id });
                                                        setCasePopoverOpen(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4 shrink-0", form.caseId === c.id ? "opacity-100" : "opacity-0")} />
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
                    <Button onClick={handleSubmit}>{task ? "Save Changes" : "Create Task"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
