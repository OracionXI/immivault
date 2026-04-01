import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-1.5">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-64" />
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-lg" />
                            <div className="space-y-1.5">
                                <Skeleton className="h-6 w-16" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs placeholder */}
            <div className="space-y-4">
                <div className="flex gap-1">
                    <Skeleton className="h-9 w-24 rounded-md" />
                    <Skeleton className="h-9 w-20 rounded-md" />
                    <Skeleton className="h-9 w-24 rounded-md" />
                </div>

                {/* Chart card */}
                <div className="rounded-xl border bg-card p-5 space-y-3">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-[260px] w-full rounded-lg" />
                </div>

                {/* Breakdown cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[0, 1].map((i) => (
                        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                            <Skeleton className="h-5 w-44" />
                            <Skeleton className="h-[280px] w-full rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
