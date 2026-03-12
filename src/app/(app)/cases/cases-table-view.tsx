"use client";

import type { Doc } from "../../../../convex/_generated/dataModel";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Briefcase, CircleUser, Pencil, Trash2 } from "lucide-react";

type ConvexCase = Doc<"cases">;

interface Props {
    cases: ConvexCase[];
    clientMap: Map<string, string>;
    userMap: Map<string, string>;
    onView: (c: ConvexCase) => void;
    onEdit?: (c: ConvexCase) => void;
    canEdit?: (c: ConvexCase) => boolean;
    onDelete?: (c: ConvexCase) => void;
}

function formatDeadline(ts?: number) {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CasesTableView({ cases, clientMap, userMap, onView, onEdit, canEdit, onDelete }: Props) {
    if (cases.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-card flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <Briefcase className="h-8 w-8 opacity-30" />
                <p className="text-sm">No cases found.</p>
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
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap">Case</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap hidden md:table-cell">Client</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap hidden lg:table-cell">Visa Type</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap">Status</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap hidden sm:table-cell">Priority</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap hidden lg:table-cell">Assigned To</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2.5 px-4 whitespace-nowrap hidden sm:table-cell">Deadline</th>
                            {showActions && <th className="py-2.5 px-4 w-16" />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {cases.map((c) => {
                            const isOverdue = c.deadline && c.deadline < Date.now();
                            const canEditThis = !canEdit || canEdit(c);
                            return (
                                <tr
                                    key={c._id}
                                    onClick={() => onView(c)}
                                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                                >
                                    <td className="py-3 px-4">
                                        <p className="font-medium text-foreground truncate max-w-[200px]">{c.title}</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{c.caseNumber}</p>
                                    </td>
                                    <td className="py-3 px-4 hidden md:table-cell">
                                        <span className="text-muted-foreground">{clientMap.get(c.clientId) ?? "—"}</span>
                                    </td>
                                    <td className="py-3 px-4 hidden lg:table-cell">
                                        <span className="text-muted-foreground">{c.visaType ?? "—"}</span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <StatusBadge status={c.status} />
                                    </td>
                                    <td className="py-3 px-4 hidden sm:table-cell">
                                        <StatusBadge status={c.priority} />
                                    </td>
                                    <td className="py-3 px-4 hidden lg:table-cell">
                                        <div className="flex items-center gap-1.5">
                                            <CircleUser className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground truncate max-w-[120px]">
                                                {c.assignedTo ? (userMap.get(c.assignedTo) ?? "—") : <span className="italic opacity-50">Unassigned</span>}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 hidden sm:table-cell">
                                        <span className={isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}>
                                            {formatDeadline(c.deadline)}
                                        </span>
                                    </td>
                                    {showActions && (
                                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {onEdit && canEditThis && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(c)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                {onDelete && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                                        onClick={() => onDelete(c)}
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
