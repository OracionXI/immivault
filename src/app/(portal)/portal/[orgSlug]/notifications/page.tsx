"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";

type PortalNotification = {
  _id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  _creationTime: number;
};

function formatDate(ts: number) {
  const diffMs = Date.now() - ts;
  const diffHours = diffMs / 3_600_000;
  if (diffHours < 1) return `${Math.round(diffMs / 60000)}m ago`;
  if (diffHours < 24) return `${Math.round(diffHours)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PortalNotificationsPage() {
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setNotifications(data.notifications ?? []);
      })
      .catch(() => setError("Failed to load notifications."))
      .finally(() => setLoading(false));
  }, []);

  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">Updates about your cases, invoices, and appointments.</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground">No notifications</p>
          <p className="text-sm text-muted-foreground mt-1 italic">Updates will appear here when your attorney makes changes.</p>
        </div>
      )}

      {!loading && unread.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">New</h2>
          <div className="space-y-2">
            {unread.map((n) => (
              <div key={n._id} className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5 flex items-start gap-3">
                <div className="h-2 w-2 rounded-full mt-2 shrink-0 bg-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{formatDate(n._creationTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && read.length > 0 && (
        <div>
          {unread.length > 0 && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">Earlier</h2>
          )}
          <div className="space-y-2">
            {read.map((n) => (
              <div key={n._id} className="rounded-xl border border-border bg-card px-4 py-3.5 flex items-start gap-3">
                <div className="h-2 w-2 rounded-full mt-2 shrink-0 bg-border" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{n.title}</p>
                  <p className="text-sm text-muted-foreground/70 mt-0.5">{n.message}</p>
                </div>
                <span className="text-xs text-muted-foreground/60 shrink-0 mt-0.5">{formatDate(n._creationTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
