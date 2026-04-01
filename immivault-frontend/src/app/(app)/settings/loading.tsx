import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
    return (
        <div className="space-y-6 pb-6">
            {/* Heading */}
            <div className="space-y-1.5">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-56" />
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar tabs */}
                <div className="flex md:flex-col w-full md:w-56 shrink-0 gap-1">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full rounded-lg" />
                    ))}
                </div>

                {/* Content card */}
                <div className="flex-1 min-w-0 rounded-xl border bg-card p-5 space-y-4">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-4 w-72" />
                    <div className="space-y-2 pt-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full rounded-md" />
                        ))}
                    </div>
                    <Skeleton className="h-9 w-28 rounded-md" />
                </div>
            </div>
        </div>
    );
}
