"use client";

import { useState } from "react";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ConvexTask = Doc<"tasks">;

interface Props {
    tasks: ConvexTask[];
    caseMap: Map<string, string>;
    onView: (t: ConvexTask) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PRIORITY_COLORS: Record<string, string> = {
    Urgent: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400",
    High: "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-400",
    Medium: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400",
    Low: "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-400",
};

export function TasksCalendarView({ tasks, caseMap, onView }: Props) {
    const [navDate, setNavDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d;
    });

    const year = navDate.getFullYear();
    const month = navDate.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Group tasks by day of month
    const byDay = new Map<number, ConvexTask[]>();
    const noDueDate: ConvexTask[] = [];
    for (const t of tasks) {
        if (!t.dueDate) {
            noDueDate.push(t);
            continue;
        }
        const d = new Date(t.dueDate);
        if (d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate();
            const arr = byDay.get(day) ?? [];
            arr.push(t);
            byDay.set(day, arr);
        }
    }

    // 6 rows × 7 cols = 42 cells
    const cells = Array.from({ length: 42 }, (_, i) => {
        const day = i - firstDow + 1;
        return day >= 1 && day <= daysInMonth ? day : null;
    });

    const isToday = (day: number) =>
        day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    const isPast = (day: number) =>
        new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setNavDate(new Date(year, month - 1, 1))}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold text-sm">
                    {navDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </h3>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setNavDate(new Date(year, month + 1, 1))}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-border">
                {DAYS.map((d) => (
                    <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-2">
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                    const items = day ? (byDay.get(day) ?? []) : [];
                    const colBorder = (i + 1) % 7 !== 0 ? "border-r" : "";
                    return (
                        <div
                            key={i}
                            className={`min-h-[88px] p-1 border-b border-border/40 ${colBorder} border-border/40 ${!day ? "bg-muted/5" : ""}`}
                        >
                            {day && (
                                <>
                                    <div className="flex justify-end mb-0.5">
                                        <span
                                            className={`text-[11px] font-semibold h-5 w-5 flex items-center justify-center rounded-full
                                                ${isToday(day)
                                                    ? "bg-primary text-primary-foreground"
                                                    : isPast(day)
                                                    ? "text-muted-foreground/40"
                                                    : "text-muted-foreground"}`}
                                        >
                                            {day}
                                        </span>
                                    </div>
                                    <div className="space-y-0.5">
                                        {items.slice(0, 3).map((t) => (
                                            <button
                                                key={t._id}
                                                onClick={() => onView(t)}
                                                className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate transition-opacity hover:opacity-75 ${PRIORITY_COLORS[t.priority] ?? "bg-muted text-muted-foreground border border-border"}`}
                                            >
                                                {t.title}
                                            </button>
                                        ))}
                                        {items.length > 3 && (
                                            <p className="text-[10px] text-muted-foreground pl-1">
                                                +{items.length - 3} more
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Tasks without a due date */}
            {noDueDate.length > 0 && (
                <div className="px-4 py-3 border-t border-border bg-muted/5">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                        No due date — {noDueDate.length} task{noDueDate.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {noDueDate.map((t) => (
                            <button
                                key={t._id}
                                onClick={() => onView(t)}
                                className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/70 truncate max-w-[200px] transition-colors"
                            >
                                {t.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
