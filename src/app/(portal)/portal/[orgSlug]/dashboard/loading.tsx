export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page title */}
      <div className="h-7 w-48 rounded-md bg-slate-200 dark:bg-slate-700" />

      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-8 w-16 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Next appointment card */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="h-9 w-32 rounded-md bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Overdue invoices card */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-700" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent cases */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-700" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="space-y-1.5">
              <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
