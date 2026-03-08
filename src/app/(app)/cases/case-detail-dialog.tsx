"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/shared/status-badge";
import { DocumentViewer } from "@/components/shared/document-viewer";
import { MentionTextarea, MentionBody } from "@/components/shared/mention-textarea";
import type { MentionableUser, MentionableDoc } from "@/components/shared/mention-textarea";
import { Pencil, Trash2, UserRound, CalendarDays, FileText, MessageSquare, Send, CheckSquare, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ConvexCase = NonNullable<ReturnType<typeof useQuery<typeof api.cases.queries.list>>>[number];
type ConvexDocument = NonNullable<ReturnType<typeof useQuery<typeof api.documents.queries.list>>>[number];

interface CaseDetailDialogProps {
    caseItem: ConvexCase | null;
    clientName: string;
    assigneeName: string;
    onClose: () => void;
    onEdit?: (c: ConvexCase) => void;
}

function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CaseDetailDialog({ caseItem, clientName, assigneeName, onClose, onEdit }: CaseDetailDialogProps) {
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBody, setEditBody] = useState("");
    const [viewer, setViewer] = useState<{ open: boolean; doc: ConvexDocument | null }>({ open: false, doc: null });

    const addComment = useMutation(api.comments.mutations.create);
    const editComment = useMutation(api.comments.mutations.update);
    const deleteComment = useMutation(api.comments.mutations.remove);
    const me = useQuery(api.users.queries.me);
    const orgUsers = useQuery(api.users.queries.listByOrg) ?? [];

    const tasks = useQuery(
        api.tasks.queries.listByCase,
        caseItem ? { caseId: caseItem._id } : "skip"
    ) ?? [];

    const allDocs = useQuery(api.documents.queries.list) ?? [];
    const caseDocs = caseItem ? allDocs.filter((d) => d.caseId === caseItem._id) : [];

    const comments = useQuery(
        api.comments.queries.listByEntity,
        caseItem ? { entityType: "case", entityId: caseItem._id } : "skip"
    ) ?? [];

    // ── @mention data ─────────────────────────────────────────────────────────
    // People: case assignee + anyone assigned to a task on this case
    const linkedUserIds = new Set<string>(
        [
            caseItem?.assignedTo as string | undefined,
            ...tasks.map((t) => t.assignedTo as string),
        ].filter((id): id is string => Boolean(id))
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
        if (!text || !caseItem || submitting) return;
        setSubmitting(true);
        setNewComment("");
        try {
            await addComment({ entityType: "case", entityId: caseItem._id, body: text });
        } finally {
            setSubmitting(false);
        }
    };

    if (!caseItem) return null;

    return (
        <>
            <Dialog open={!!caseItem} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-4xl max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
                    {/* Header */}
                    <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                        <div className="flex items-start gap-3 pr-8">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground font-mono mb-1">CASE · {caseItem.caseNumber}</p>
                                <DialogTitle className="text-xl leading-snug">{caseItem.title}</DialogTitle>
                                <div className="flex gap-2 mt-2">
                                    <StatusBadge status={caseItem.status} />
                                    <StatusBadge status={caseItem.priority} />
                                </div>
                            </div>
                            {onEdit && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => { onClose(); onEdit(caseItem); }}
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
                                {/* Notes */}
                                <section>
                                    <div className="flex items-center gap-2 mb-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <h3 className="text-sm font-semibold">Notes</h3>
                                    </div>
                                    {caseItem.notes ? (
                                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2.5">
                                            {caseItem.notes}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">No notes provided.</p>
                                    )}
                                </section>

                                <Separator />

                                {/* Tasks */}
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <CheckSquare className="h-4 w-4 text-muted-foreground" />
                                        <h3 className="text-sm font-semibold">Tasks</h3>
                                        {tasks.length > 0 && (
                                            <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                                                {tasks.length}
                                            </span>
                                        )}
                                    </div>
                                    {tasks.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">No tasks for this case.</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {tasks.map((t) => (
                                                <div key={t._id} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
                                                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{t.taskId}</span>
                                                    <span className="text-sm flex-1 truncate">{t.title}</span>
                                                    <StatusBadge status={t.status} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <Separator />

                                {/* Documents */}
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <h3 className="text-sm font-semibold">Documents</h3>
                                        {caseDocs.length > 0 && (
                                            <span className="text-xs bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                                                {caseDocs.length}
                                            </span>
                                        )}
                                    </div>
                                    {caseDocs.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">No documents for this case.</p>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {caseDocs.map((d) => (
                                                <div key={d._id} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
                                                    <span className="text-sm flex-1 truncate">{d.name}</span>
                                                    <StatusBadge status={d.status} />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 shrink-0"
                                                        onClick={() => setViewer({ open: true, doc: d })}
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
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

                                    {comments.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic mb-4">No comments yet.</p>
                                    ) : (
                                        <div className="space-y-4 mb-4">
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
                                                                                onClick={() => deleteComment({ id: comment._id })}
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
                                                                                await editComment({ id: comment._id, body: editBody.trim() });
                                                                                setEditingId(null);
                                                                                setEditBody("");
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

                                    <div className="flex gap-3">
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
                                </section>
                            </div>
                        </ScrollArea>

                        {/* Right sidebar */}
                        <aside className="w-56 shrink-0 border-l bg-muted/20 px-4 py-5 overflow-y-auto">
                            <div className="space-y-4">
                                <Detail label="Client">
                                    <div className="flex items-center gap-1.5">
                                        <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-sm font-medium">{clientName}</span>
                                    </div>
                                </Detail>

                                <Detail label="Type">
                                    <span className="text-sm font-mono font-medium bg-muted rounded px-1.5 py-0.5">
                                        {caseItem.visaType || "None"}
                                    </span>
                                </Detail>

                                <Detail label="Issue">
                                    <span className="text-sm font-mono font-medium bg-muted rounded px-1.5 py-0.5">
                                        {caseItem.issue ?? "None"}
                                    </span>
                                </Detail>

                                <Detail label="Assigned To">
                                    <div className={cn("flex items-center gap-2")}>
                                        <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-primary/10 text-primary">
                                            {getInitials(assigneeName)}
                                        </div>
                                        <span className="text-sm font-medium">{assigneeName}</span>
                                    </div>
                                </Detail>

                                <Separator />

                                {caseItem.deadline && (
                                    <Detail label="Deadline">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                            <span className="text-sm">{formatTs(caseItem.deadline)}</span>
                                        </div>
                                    </Detail>
                                )}

                                <Detail label="Created">
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                        <span className="text-sm">{formatTs(caseItem._creationTime)}</span>
                                    </div>
                                </Detail>
                            </div>
                        </aside>
                    </div>
                </DialogContent>
            </Dialog>

            {viewer.doc && (
                <DocumentViewer
                    open={viewer.open}
                    onOpenChange={(v) => setViewer({ open: v, doc: viewer.doc })}
                    docId={viewer.doc._id as Id<"documents">}
                    name={viewer.doc.name}
                    mimeType={viewer.doc.mimeType}
                />
            )}
        </>
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
