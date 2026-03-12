"use client";

import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, CircleUser, Pencil, Trash2 } from "lucide-react";

type ConvexTask = Doc<"tasks">;

interface Props {
    tasks: ConvexTask[];
    userMap: Map<string, string>;
    caseMap: Map<string, string>;
    onView: (t: ConvexTask) => void;
    onEdit?: (t: ConvexTask) => void;
    onDelete?: (t: ConvexTask) => void;
}

function formatDue(ts?: number) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TasksTableView({ tasks, userMap, caseMap, onView, onEdit, onDelete }: Props) {
    if (tasks.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <CheckSquare className="h-8 w-8 opacity-30" />
                <p className="text-sm">No tasks found.</p>
            </div>
        );
    }

    const showActions = !!(onEdit || onDelete);

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/20">
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap">Task</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap hidden md:table-cell">Case</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap">Status</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap hidden sm:table-cell">Priority</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap hidden lg:table-cell">Assigned To</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap hidden sm:table-cell">Due Date</th>
                            {showActions && <th className="py-2.5 px-4 w-16" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {tasks.map((t) => {
                            const isOverdue = t.dueDate && t.dueDate < Date.now() && t.status !== "Completed";
                            return (
                                <tr
                                    key={t._id}
                                    onClick={() => onView(t)}
                                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                                >
                                    <td className="py-3 px-4">
                                        <p className="font-medium text-foreground truncate max-w-[200px]">{t.title}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{t.taskId}</p>
                                    </td>
                                    <td className="py-3 px-4 hidden md:table-cell">
                                        <span className="text-muted-foreground truncate max-w-[160px] block">
                                            {t.caseId ? (caseMap.get(t.caseId as string) ?? "—") : <span className="italic opacity-50">No case</span>}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <StatusBadge status={t.status} />
                                    </td>
                                    <td className="py-3 px-4 hidden sm:table-cell">
                                        <StatusBadge status={t.priority} />
                                    </td>
                                    <td className="py-3 px-4 hidden lg:table-cell">
                                        <div className="flex items-center gap-1.5">
                                            <CircleUser className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground truncate max-w-[120px]">
                                                {t.assignedTo ? (userMap.get(t.assignedTo as string) ?? "—") : <span className="italic opacity-50">Unassigned</span>}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 hidden sm:table-cell">
                                        <span className={isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}>
                                            {formatDue(t.dueDate)}
                                        </span>
                                    </td>
                                    {showActions && (
                                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {onEdit && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(t)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                {onDelete && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                                        onClick={() => onDelete(t)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
