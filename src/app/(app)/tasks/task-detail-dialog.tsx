"use client";

import { useState } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pencil, CalendarDays, FileText, MessageSquare, Send, Layers } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Comment {
    id: string;
    author: string;
    text: string;
    createdAt: string;
}

interface TaskDetailDialogProps {
    task: Task | null;
    onClose: () => void;
    onEdit: (t: Task) => void;
}

function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(dateStr: string) {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return dateStr; }
}

function isOverdue(dateStr: string) {
    try {
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && d < new Date();
    } catch { return false; }
}

const CURRENT_USER = "Sarah Chen";

const avatarColor: Record<string, string> = {
    "Sarah Chen":  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    "John Miller": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    "Emily Davis": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function TaskDetailDialog({ task, onClose, onEdit }: TaskDetailDialogProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");

    const handleAddComment = () => {
        const text = newComment.trim();
        if (!text) return;
        setComments((prev) => [
            ...prev,
            {
                id: `cmt-${Date.now()}`,
                author: CURRENT_USER,
                text,
                createdAt: new Date().toISOString(),
            },
        ]);
        setNewComment("");
    };

    if (!task) return null;

    const overdue = task.dueDate ? isOverdue(task.dueDate) : false;

    return (
        <Dialog open={!!task} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-mono mb-1">TASK · {task.id.toUpperCase()}</p>
                            <DialogTitle className="text-xl leading-snug">{task.title}</DialogTitle>
                            <div className="flex gap-2 mt-2">
                                <StatusBadge status={task.status} />
                                <StatusBadge status={task.priority} />
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => { onClose(); onEdit(task); }}
                        >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                        </Button>
                    </div>
                </DialogHeader>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Main column */}
                    <ScrollArea className="flex-1 px-6 py-5">
                        <div className="space-y-6 pr-4">
                            {/* Description */}
                            <section>
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="text-sm font-semibold">Description</h3>
                                </div>
                                {task.description ? (
                                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2.5">
                                        {task.description}
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">No description provided.</p>
                                )}
                            </section>

                            <Separator />

                            {/* Activity / Comments */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="text-sm font-semibold">Activity</h3>
                                    {comments.length > 0 && (
                                        <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                                            {comments.length}
                                        </span>
                                    )}
                                </div>

                                {comments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic mb-4">No comments yet.</p>
                                ) : (
                                    <div className="space-y-4 mb-4">
                                        {comments.map((comment) => (
                                            <div key={comment.id} className="flex gap-3">
                                                <div
                                                    className={cn(
                                                        "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                                                        avatarColor[comment.author] ?? "bg-primary/10 text-primary"
                                                    )}
                                                >
                                                    {getInitials(comment.author)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline gap-2 mb-1">
                                                        <span className="text-xs font-semibold">{comment.author}</span>
                                                        <span className="text-[11px] text-muted-foreground">
                                                            {formatDate(comment.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2">
                                                        {comment.text}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add comment */}
                                <div className="flex gap-3">
                                    <div
                                        className={cn(
                                            "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1.5",
                                            avatarColor[CURRENT_USER] ?? "bg-primary/10 text-primary"
                                        )}
                                    >
                                        {getInitials(CURRENT_USER)}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <Textarea
                                            placeholder="Add a comment..."
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            rows={2}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                                    e.preventDefault();
                                                    handleAddComment();
                                                }
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            onClick={handleAddComment}
                                            disabled={!newComment.trim()}
                                        >
                                            <Send className="h-3.5 w-3.5 mr-1.5" />
                                            Comment
                                        </Button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </ScrollArea>

                    {/* Right sidebar */}
                    <aside className="w-56 shrink-0 border-l bg-muted/20 px-4 py-5 overflow-y-auto">
                        <div className="space-y-4">
                            <Detail label="Assignee">
                                <div className="flex items-center gap-2">
                                    <div
                                        className={cn(
                                            "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                            avatarColor[task.assignee] ?? "bg-primary/10 text-primary"
                                        )}
                                    >
                                        {getInitials(task.assignee)}
                                    </div>
                                    <span className="text-sm font-medium">{task.assignee}</span>
                                </div>
                            </Detail>

                            <Detail label="Due Date">
                                <div className={cn("flex items-center gap-1.5", overdue ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>
                                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                    <span className="text-sm font-medium">{formatDate(task.dueDate)}</span>
                                    {overdue && <span className="text-[10px] font-semibold">OVERDUE</span>}
                                </div>
                            </Detail>

                            {task.caseName && (
                                <Detail label="Related Case">
                                    <div className="flex items-start gap-1.5 text-muted-foreground">
                                        <Layers className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                        <span className="text-sm leading-snug">{task.caseName}</span>
                                    </div>
                                </Detail>
                            )}

                            <Separator />

                            <Detail label="Created">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                    <span className="text-sm">{formatDate(task.createdAt)}</span>
                                </div>
                            </Detail>
                        </div>
                    </aside>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}
