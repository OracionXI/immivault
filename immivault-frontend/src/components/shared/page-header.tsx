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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {description && (
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                )}
            </div>
            {actionLabel && onAction && (
                <div className="w-full sm:w-auto">
                    <Button onClick={onAction} className="gap-2 w-full sm:w-auto">
                        {actionIcon || <Plus className="h-4 w-4" />}
                        {actionLabel}
                    </Button>
                </div>
            )}
        </div>
    );
}
