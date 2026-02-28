import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface PageHeaderProps {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    actionIcon?: React.ReactNode;
}

export function PageHeader({
    title,
    description,
    actionLabel,
    onAction,
    actionIcon,
}: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {description && (
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                )}
            </div>
            {actionLabel && onAction && (
                <Button onClick={onAction} className="gap-2">
                    {actionIcon || <Plus className="h-4 w-4" />}
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}
