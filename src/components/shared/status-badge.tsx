import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    inactive: { label: "Inactive", className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20" },
    pending: { label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    archived: { label: "Archived", className: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20" },
    // Case stages
    "New": { label: "New", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
    "In Progress": { label: "In Progress", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    "Under Review": { label: "Under Review", className: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/20" },
    "Approved": { label: "Approved", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    "Closed": { label: "Closed", className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20" },
    // Task statuses
    "To Do": { label: "To Do", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
    "Review": { label: "Review", className: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/20" },
    "Done": { label: "Done", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    // Invoice statuses
    "Draft": { label: "Draft", className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20" },
    "Sent": { label: "Sent", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
    "Paid": { label: "Paid", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    "Overdue": { label: "Overdue", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
    // Payment statuses
    "Completed": { label: "Completed", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    "Pending": { label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    "Failed": { label: "Failed", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
    "Refunded": { label: "Refunded", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20" },
    // Priorities
    "Low": { label: "Low", className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20" },
    "Medium": { label: "Medium", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
    "High": { label: "High", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    "Urgent": { label: "Urgent", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
};

interface StatusBadgeProps {
    status: string;
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const config = statusConfig[status] || {
        label: status,
        className: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
    };

    return (
        <Badge
            variant="outline"
            className={cn("font-medium text-xs", config.className, className)}
        >
            {config.label}
        </Badge>
    );
}
