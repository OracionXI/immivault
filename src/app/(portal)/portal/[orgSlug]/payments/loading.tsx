export default function PaymentsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page title */}
      <div className="h-7 w-32 rounded-md bg-slate-200 dark:bg-slate-700" />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
            <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-7 w-20 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>

      {/* Payment history list */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b">
          <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4 border-b last:border-0">
            <div className="space-y-1.5">
              <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-6 w-14 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
