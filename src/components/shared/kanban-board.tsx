"use client";

import { useState, useCallback, useEffect } from "react";
import {
    DragDropContext,
    Droppable,
    Draggable,
    type DropResult,
} from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { StatusBadge } from "./status-badge";
import { Pencil, Trash2, GripVertical, CalendarDays, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KanbanItem {
    id: string;
    title: string;
    subtitle?: string;
    status: string;
    priority?: string;
    assignee?: string;
    dueDate?: string;
    [key: string]: unknown;
}

export interface KanbanColumn {
    id: string;
    title: string;
    color?: string;
}

interface KanbanBoardProps {
    columns: KanbanColumn[];
    items: KanbanItem[];
    onItemClick?: (item: KanbanItem) => void;
    onItemEdit?: (item: KanbanItem) => void;
    onItemDelete?: (item: KanbanItem) => void;
    onItemMove?: (itemId: string, newStatus: string) => void;
    statusKey?: string;
}

const priorityBorderColor: Record<string, string> = {
    Urgent: "border-l-red-500",
    High:   "border-l-amber-500",
    Medium: "border-l-blue-500",
    Low:    "border-l-zinc-300 dark:border-l-zinc-600",
};

const assigneeBgColor: Record<string, string> = {
    "Sarah Chen":   "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    "John Miller":  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    "Emily Davis":  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
        return dateStr;
    }
}

function isOverdue(dateStr: string): boolean {
    try {
        const d = new Date(dateStr);
        return !isNaN(d.getTime()) && d < new Date();
    } catch {
        return false;
    }
}

export function KanbanBoard({
    columns,
    items,
    onItemClick,
    onItemEdit,
    onItemDelete,
    onItemMove,
    statusKey = "status",
}: KanbanBoardProps) {
    const [boardItems, setBoardItems] = useState(items);

    useEffect(() => {
        setBoardItems(items);
    }, [items]);

    const getColumnItems = useCallback(
        (columnId: string) =>
            boardItems.filter((item) => item[statusKey] === columnId),
        [boardItems, statusKey]
    );

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const { draggableId, destination } = result;
        const newStatus = destination.droppableId;
        setBoardItems((prev) =>
            prev.map((item) =>
                item.id === draggableId
                    ? { ...item, [statusKey]: newStatus }
                    : item
            )
        );
        onItemMove?.(draggableId, newStatus);
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4 min-w-max">
                    {columns.map((column) => {
                        const colItems = getColumnItems(column.id);
                        return (
                            <div key={column.id} className="w-[300px] shrink-0 flex flex-col">
                                {/* Column Header */}
                                <div className="flex items-center gap-2 mb-3 px-1">
                                    <div
                                        className="h-2.5 w-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: column.color || "#6b7280" }}
                                    />
                                    <h3 className="font-semibold text-sm">{column.title}</h3>
                                    <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                                        {colItems.length}
                                    </span>
                                </div>

                                {/* Column Body */}
                                <Droppable droppableId={column.id}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={cn(
                                                "flex-1 space-y-2.5 rounded-xl p-2 min-h-[200px] transition-colors",
                                                snapshot.isDraggingOver
                                                    ? "bg-accent/60"
                                                    : "bg-muted/30"
                                            )}
                                        >
                                            {colItems.map((item, index) => {
                                                const overdue = item.dueDate
                                                    ? isOverdue(item.dueDate as string)
                                                    : false;
                                                const assigneeName = item.assignee as string | undefined;
                                                const avatarColor =
                                                    assigneeName && assigneeBgColor[assigneeName]
                                                        ? assigneeBgColor[assigneeName]
                                                        : "bg-primary/10 text-primary";

                                                return (
                                                    <Draggable
                                                        key={item.id}
                                                        draggableId={item.id}
                                                        index={index}
                                                    >
                                                        {(provided, snapshot) => (
                                                            <Card
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={cn(
                                                                    "group cursor-pointer transition-all duration-200 border-l-4 overflow-hidden",
                                                                    item.priority
                                                                        ? (priorityBorderColor[item.priority] ?? "border-l-transparent")
                                                                        : "border-l-transparent",
                                                                    snapshot.isDragging
                                                                        ? "shadow-xl rotate-1 scale-[1.02]"
                                                                        : "hover:shadow-md"
                                                                )}
                                                                onClick={() => onItemClick?.(item)}
                                                            >
                                                                <CardContent className="p-0">
                                                                    {/* Card Body */}
                                                                    <div className="p-3 space-y-2">
                                                                        {/* Top row: drag handle + title + actions */}
                                                                        <div className="flex items-start gap-1.5">
                                                                            <div
                                                                                {...provided.dragHandleProps}
                                                                                className="mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing shrink-0"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                                            </div>
                                                                            <p className="text-sm font-semibold leading-snug flex-1 line-clamp-2">
                                                                                {item.title}
                                                                            </p>
                                                                            <div
                                                                                className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-6 w-6"
                                                                                    onClick={() => onItemEdit?.(item)}
                                                                                >
                                                                                    <Pencil className="h-3 w-3" />
                                                                                </Button>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                                                                    onClick={() => onItemDelete?.(item)}
                                                                                >
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>

                                                                        {/* Subtitle */}
                                                                        {item.subtitle && (
                                                                            <div className="flex items-center gap-1.5 pl-5">
                                                                                <UserRound className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                                <p className="text-xs text-muted-foreground truncate">
                                                                                    {item.subtitle}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Divider */}
                                                                    <div className="mx-3 border-t border-border/50" />

                                                                    {/* Footer */}
                                                                    <div className="flex items-center gap-2 px-3 py-2">
                                                                        {/* Priority badge */}
                                                                        {item.priority && (
                                                                            <StatusBadge status={item.priority} />
                                                                        )}

                                                                        {/* Due date */}
                                                                        {item.dueDate && (
                                                                            <div
                                                                                className={cn(
                                                                                    "flex items-center gap-1 ml-auto",
                                                                                    overdue
                                                                                        ? "text-red-500 dark:text-red-400"
                                                                                        : "text-muted-foreground"
                                                                                )}
                                                                            >
                                                                                <CalendarDays className="h-3 w-3 shrink-0" />
                                                                                <span className="text-[11px] font-medium">
                                                                                    {formatDate(item.dueDate as string)}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Assignee avatar */}
                                                                        {assigneeName && (
                                                                            <div
                                                                                className={cn(
                                                                                    "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                                                                    avatarColor
                                                                                )}
                                                                                title={assigneeName}
                                                                            >
                                                                                {getInitials(assigneeName)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        )}
                                                    </Draggable>
                                                );
                                            })}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        );
                    })}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </DragDropContext>
    );
}
