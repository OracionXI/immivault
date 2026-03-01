"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pencil, UserRound, CalendarDays, FileText, MessageSquare, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type ConvexCase = NonNullable<ReturnType<typeof useQuery<typeof api.cases.queries.list>>>[number];

interface CaseDetailDialogProps {
    caseItem: ConvexCase | null;
    clientName: string;
    assigneeName: string;
    onClose: () => void;
    onEdit: (c: ConvexCase) => void;
}

interface LocalComment {
    id: string;
    author: string;
    text: string;
    createdAt: string;
}

function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const CURRENT_USER = "You";

export function CaseDetailDialog({ caseItem, clientName, assigneeName, onClose, onEdit }: CaseDetailDialogProps) {
    const [comments, setComments] = useState<LocalComment[]>([]);
    const [newComment, setNewComment] = useState("");

    const handleAddComment = () => {
        const text = newComment.trim();
        if (!text) return;
        setComments((prev) => [
            ...prev,
            { id: `cmt-${Date.now()}`, author: CURRENT_USER, text, createdAt: new Date().toISOString() },
        ]);
        setNewComment("");
    };

    if (!caseItem) return null;

    return (
        <Dialog open={!!caseItem} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground font-mono mb-1">CASE · {caseItem.caseNumber}</p>
                            <DialogTitle className="text-xl leading-snug">{caseItem.title}</DialogTitle>
                            <div className="flex gap-2 mt-2">
                                <StatusBadge status={caseItem.status} />
                                <StatusBadge status={caseItem.priority} />
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => { onClose(); onEdit(caseItem); }}
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
                            {/* Notes / Description */}
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
                                                <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 bg-primary/10 text-primary">
                                                    {getInitials(comment.author)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline gap-2 mb-1">
                                                        <span className="text-xs font-semibold">{comment.author}</span>
                                                        <span className="text-[11px] text-muted-foreground">
                                                            {new Date(comment.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
                                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1.5 bg-primary/10 text-primary">
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
                                        <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
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

                            <Detail label="Visa Type">
                                <span className="text-sm font-mono font-medium bg-muted rounded px-1.5 py-0.5">
                                    {caseItem.visaType}
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
