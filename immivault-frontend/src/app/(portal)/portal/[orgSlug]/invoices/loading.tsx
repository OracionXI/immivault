export default function InvoicesLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page title */}
      <div className="h-7 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />

      {/* Table-like list */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-5 py-3 border-b bg-slate-50 dark:bg-slate-800/50">
          {[80, 100, 80, 80, 60].map((w, i) => (
            <div key={i} className={`h-3.5 w-${w === 60 ? 16 : w === 80 ? 20 : 24} rounded bg-slate-200 dark:bg-slate-700`} style={{ width: w }} />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b last:border-0">
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="ml-auto h-8 w-24 rounded-md bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
