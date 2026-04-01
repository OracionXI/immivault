export default function AppointmentsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page title + book button */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded-md bg-slate-200 dark:bg-slate-700" />
        <div className="h-9 w-36 rounded-md bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-md bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>

      {/* Appointment cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-5 w-52 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="flex gap-4">
            <div className="h-3.5 w-32 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3.5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      ))}
    </div>
  );
}
