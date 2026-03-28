export default function NotificationsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Page title + mark-all button */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-md bg-slate-200 dark:bg-slate-700" />
        <div className="h-8 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Notification items */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 px-5 py-4 border-b last:border-0">
            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3.5 w-full rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
