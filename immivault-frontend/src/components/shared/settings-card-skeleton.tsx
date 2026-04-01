import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Generic skeleton for settings pages that load data from Convex before rendering.
 * Use when `useQuery` returns `undefined` (initial load).
 */
export function SettingsCardSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <Card>
            <CardHeader className="space-y-2">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex gap-2">
                    <Skeleton className="h-9 flex-1 rounded-md" />
                    <Skeleton className="h-9 w-20 rounded-md" />
                </div>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <Skeleton className="h-9 flex-1 rounded-md" />
                        <Skeleton className="h-9 w-9 rounded-md" />
                    </div>
                ))}
                <Skeleton className="h-9 w-28 rounded-md mt-2" />
            </CardContent>
        </Card>
    );
}
