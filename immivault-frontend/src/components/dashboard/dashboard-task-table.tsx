"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, CircleUser, Inbox } from "lucide-react";
import Link from "next/link";
import { useRole } from "@/hooks/use-role";

function formatDue(ts: number | null): { label: string; overdue: boolean } {
    if (!ts) return { label: "—", overdue: false };
    const now = Date.now();
    const overdue = ts < now;
    const label = new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return { label, overdue };
}

export function DashboardTaskTable() {
    const { isCaseManager } = useRole();
    const tasks = useQuery(api.dashboard.queries.dashboardTasks);

    if (tasks === undefined) {
        return (
            <div className="h-48 flex items-center justify-center">
                <span className="text-sm text-muted-foreground animate-pulse">Loading tasks…</span>
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Inbox className="h-8 w-8 opacity-40" />
                <p className="text-sm">No active tasks assigned to you.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap">Task</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap hidden md:table-cell">Case</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap">Status</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap hidden sm:table-cell">Priority</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap hidden lg:table-cell">Assigned To</th>
                            <th className="text-left text-xs font-semibold text-muted-foreground py-2 px-3 whitespace-nowrap hidden sm:table-cell">Due Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {tasks.map((task) => {
                            const due = formatDue(task.dueDate);
                            return (
                                <tr key={task._id} className="hover:bg-muted/30 transition-colors group">
                                    {/* Task name */}
                                    <td className="py-3 px-3">
                                        <div className="flex items-start gap-2 min-w-0">
                                            <div className="min-w-0">
                                                <p className="font-medium text-foreground truncate max-w-[180px] sm:max-w-[240px]">
                                                    {task.title}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">{task.taskId}</p>
                                            </div>
                                            {isCaseManager && !task.isMine && (
                                                <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 mt-0.5">
                                                    Monitoring
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Case */}
                                    <td className="py-3 px-3 hidden md:table-cell">
                                        <span className="text-muted-foreground truncate max-w-[140px] block">
                                            {task.caseTitle ?? <span className="italic opacity-50">No case</span>}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="py-3 px-3">
                                        <StatusBadge status={task.status} />
                                    </td>

                                    {/* Priority */}
                                    <td className="py-3 px-3 hidden sm:table-cell">
                                        <StatusBadge status={task.priority} />
                                    </td>

                                    {/* Assigned To */}
                                    <td className="py-3 px-3 hidden lg:table-cell">
                                        <div className="flex items-center gap-1.5">
                                            <CircleUser className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground truncate max-w-[120px]">
                                                {task.assigneeName ?? "Unassigned"}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Due Date */}
                                    <td className="py-3 px-3 hidden sm:table-cell">
                                        <span className={due.overdue ? "text-red-500 font-medium" : "text-muted-foreground"}>
                                            {due.label}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-5 py-4 border-t border-border bg-accent/20">
                <Button variant="link" asChild className="p-0 h-auto text-xs font-semibold text-primary hover:text-primary/80">
                    <Link href="/tasks">View all tasks <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
                </Button>
            </div>
        </div>
    );
}
