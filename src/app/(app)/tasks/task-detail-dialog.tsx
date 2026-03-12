"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/shared/status-badge";
import { MentionTextarea, MentionBody } from "@/components/shared/mention-textarea";
import type { MentionableUser, MentionableDoc } from "@/components/shared/mention-textarea";
import { Pencil, Trash2, CalendarDays, FileText, MessageSquare, Send, Layers, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

type ConvexTask = NonNullable<ReturnType<typeof useQuery<typeof api.tasks.queries.list>>>[number];

interface TaskDetailDialogProps {
    task: ConvexTask | null;
    assigneeName: string;
    caseName: string;
    onClose: () => void;
    onEdit?: (t: ConvexTask) => void;
}

function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(ts: number) {
    return ts < Date.now();
}

export function TaskDetailDialog({ task, assigneeName, caseName, onClose, onEdit }: TaskDetailDialogProps) {
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBody, setEditBody] = useState("");

    const addComment = useMutation(api.comments.mutations.create);
    const editComment = useMutation(api.comments.mutations.update);
    const deleteComment = useMutation(api.comments.mutations.remove);
    const me = useQuery(api.users.queries.me);
    const orgUsers = useQuery(api.users.queries.listByOrg) ?? [];

    // Convex-backed comments for this task
    const comments = useQuery(
        api.comments.queries.listByEntity,
        task ? { entityType: "task", entityId: task._id } : "skip"
    ) ?? [];

    // All tasks on the parent case — used to compute case-linked people
    const tasksByCase = useQuery(
        api.tasks.queries.listByCase,
        task?.caseId ? { caseId: task.caseId } : "skip"
    ) ?? [];

    // Documents on the parent case — offered for @doc mentions
    const allDocs = useQuery(api.documents.queries.list) ?? [];
    const caseDocs = task?.caseId
        ? allDocs.filter((d) => d.caseId === task.caseId)
        : [];

    // ── @mention data ─────────────────────────────────────────────────────────
    // People: anyone assigned to any task on the parent case
    const linkedUserIds = new Set<string>(
        tasksByCase
            .map((t) => t.assignedTo as string | undefined)
            .filter((id): id is string => Boolean(id))
    );
    const mentionUsers: MentionableUser[] = orgUsers
        .filter((u) => linkedUserIds.has(u._id))
        .map((u) => ({ id: u._id, name: u.fullName }));
    const mentionDocs: MentionableDoc[] = caseDocs.map((d) => ({ id: d._id, name: d.name }));

    function getAuthorName(authorId: string) {
        if (authorId === me?._id) return "You";
        return orgUsers.find((u) => u._id === authorId)?.fullName ?? "Unknown";
    }

    const handleAddComment = async () => {
        const text = newComment.trim();
        if (!text || !task || submitting) return;
        setSubmitting(true);
        setNewComment("");
        try {
            await addComment({ entityType: "task", entityId: task._id, body: text });
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setSubmitting(false);
        }
    };

    if (!task) return null;

    const overdue = task.dueDate ? isOverdue(task.dueDate) : false;

    return (
        <Dialog open={!!task} onOpenChange={onClose}>
            <DialogContent style={{ width: "85vw", maxWidth: "85vw", height: "90vh", maxHeight: "90vh" }} className="flex flex-col gap-0 p-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <div className="flex items-start gap-3 pr-8">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-mono mb-1">TASK · {task.taskId}</p>
                            <DialogTitle className="text-xl leading-snug">{task.title}</DialogTitle>
                            <div className="flex gap-2 mt-2">
                                <StatusBadge status={task.status} />
                                <StatusBadge status={task.priority} />
                            </div>
                        </div>
                        {onEdit && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                onClick={() => { onClose(); onEdit(task); }}
                            >
                                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                Edit
                            </Button>
                        )}
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
                                        <MentionBody body={task.description} />
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">No description provided.</p>
                                )}
                            </section>

                            <Separator />

                            {/* Activity */}
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

                                <div className="flex gap-3 mb-4">
                                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1.5 bg-primary/10 text-primary">
                                        {getInitials(me?.fullName ?? "?")}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <MentionTextarea
                                            placeholder="Add a comment… type @ to mention people or documents"
                                            value={newComment}
                                            onChange={setNewComment}
                                            rows={2}
                                            users={mentionUsers}
                                            docs={mentionDocs}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                                    e.preventDefault();
                                                    handleAddComment();
                                                }
                                            }}
                                        />
                                        <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim() || submitting}>
                                            <Send className="h-3.5 w-3.5 mr-1.5" />
                                            Comment
                                        </Button>
                                    </div>
                                </div>

                                {comments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No comments yet.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {comments.map((comment) => {
                                            const authorName = getAuthorName(comment.authorId);
                                            const isOwn = comment.authorId === me?._id;
                                            const isAdmin = me?.role === "admin";
                                            const canDelete = isOwn || isAdmin;
                                            const isEditing = editingId === comment._id;
                                            return (
                                                <div key={comment._id} className="flex gap-3 group">
                                                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 bg-primary/10 text-primary">
                                                        {getInitials(authorName)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline gap-2 mb-1">
                                                            <span className="text-xs font-semibold">{authorName}</span>
                                                            <span className="text-[11px] text-muted-foreground">
                                                                {new Date(comment._creationTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                            </span>
                                                            {(isOwn || canDelete) && !isEditing && (
                                                                <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {isOwn && (
                                                                        <button
                                                                            className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                                                                            onClick={() => { setEditingId(comment._id); setEditBody(comment.body); }}
                                                                        >
                                                                            <Pencil className="h-3 w-3" />
                                                                        </button>
                                                                    )}
                                                                    {canDelete && (
                                                                        <button
                                                                            className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                                                                            onClick={() => deleteComment({ id: comment._id }).catch((e) => toast.error(getErrorMessage(e)))}
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </button>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isEditing ? (
                                                            <div className="space-y-2">
                                                                <MentionTextarea
                                                                    value={editBody}
                                                                    onChange={setEditBody}
                                                                    rows={2}
                                                                    autoFocus
                                                                    users={mentionUsers}
                                                                    docs={mentionDocs}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Escape") { setEditingId(null); setEditBody(""); }
                                                                    }}
                                                                />
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        disabled={!editBody.trim()}
                                                                        onClick={async () => {
                                                                            if (!editBody.trim()) return;
                                                                            try {
                                                                                await editComment({ id: comment._id, body: editBody.trim() });
                                                                                setEditingId(null);
                                                                                setEditBody("");
                                                                            } catch (e) {
                                                                                toast.error(getErrorMessage(e));
                                                                            }
                                                                        }}
                                                                    >
                                                                        Save
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => { setEditingId(null); setEditBody(""); }}
                                                                    >
                                                                        <X className="h-3.5 w-3.5 mr-1" />
                                                                        Cancel
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2">
                                                                <MentionBody body={comment.body} />
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>
                    </ScrollArea>

                    {/* Right sidebar */}
                    <aside className="w-56 shrink-0 border-l bg-muted/20 px-4 py-5 overflow-y-auto">
                        <div className="space-y-4">
                            <Detail label="Assignee">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-primary/10 text-primary">
                                        {getInitials(assigneeName)}
                                    </div>
                                    <span className="text-sm font-medium">{assigneeName}</span>
                                </div>
                            </Detail>

                            {task.dueDate && (
                                <Detail label="Due Date">
                                    <div className={cn("flex items-center gap-1.5", overdue ? "text-red-500 dark:text-red-400" : "text-muted-foreground")}>
                                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                        <span className="text-sm font-medium">{formatTs(task.dueDate)}</span>
                                        {overdue && <span className="text-[10px] font-semibold">OVERDUE</span>}
                                    </div>
                                </Detail>
                            )}

                            {caseName && (
                                <Detail label="Related Case">
                                    <div className="flex items-start gap-1.5 text-muted-foreground">
                                        <Layers className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                        <span className="text-sm leading-snug">{caseName}</span>
                                    </div>
                                </Detail>
                            )}

                            <Separator />

                            <Detail label="Created">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                    <span className="text-sm">{formatTs(task._creationTime)}</span>
                                </div>
                            </Detail>

                            {task.updatedAt && (
                                <Detail label="Last Updated">
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                        <span className="text-sm">{formatTs(task.updatedAt)}</span>
                                    </div>
                                    {task.updatedBy && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            by {orgUsers.find((u) => u._id === task.updatedBy)?.fullName ?? "Unknown"}
                                        </p>
                                    )}
                                </Detail>
                            )}
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
