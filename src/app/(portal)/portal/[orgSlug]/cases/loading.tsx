export default function CasesLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page title */}
      <div className="h-7 w-32 rounded-md bg-slate-200 dark:bg-slate-700" />

      {/* Search bar */}
      <div className="h-10 w-full rounded-lg bg-slate-200 dark:bg-slate-700" />

      {/* Case cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-5 w-56 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-3.5 w-28 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      ))}
    </div>
  );
}
