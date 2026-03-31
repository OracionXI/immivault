import { cn } from "@/lib/utils";

interface UnassignedBadgeProps {
    className?: string;
}

export function UnassignedBadge({ className }: UnassignedBadgeProps) {
    return (
        <span className={cn("italic opacity-50", className)}>Unassigned</span>
    );
}
