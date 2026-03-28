export default function ProfileLoading() {
  return (
    <div className="space-y-6 animate-pulse max-w-2xl">
      {/* Page title */}
      <div className="h-7 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />

      {/* Avatar + name section */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        {/* Two-column row */}
        {Array.from({ length: 2 }).map((_, row) => (
          <div key={row} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, col) => (
              <div key={col} className="space-y-2">
                <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-10 w-full rounded-md bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        ))}

        {/* Single-column rows */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-10 w-full rounded-md bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}

        {/* Save button */}
        <div className="h-10 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}
