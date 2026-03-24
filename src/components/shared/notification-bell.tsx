"use client";

import { useQuery, useMutation } from "convex/react";
import { useRef, useEffect } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Bell, Briefcase, CheckSquare, MessageSquare, AtSign, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Sound ───────────────────────────────────────────────────────────────────

function playNotificationSound() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => void ctx.close();
  } catch {
    // Audio unavailable — silently skip
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationType =
  | "case_created"
  | "case_assigned"
  | "case_status_changed"
  | "case_deadline"
  | "case_updated"
  | "task_assigned"
  | "task_status_changed"
  | "task_overdue"
  | "task_updated"
  | "comment"
  | "mention"
  | "document_uploaded"
  | "appointment_created"
  | "appointment_updated"
  | "appointment_cancelled"
  | "payment_dispute";

const VALID_NOTIFICATION_TYPES = new Set<string>([
  "case_created", "case_assigned", "case_status_changed", "case_deadline", "case_updated",
  "task_assigned", "task_status_changed", "task_overdue", "task_updated",
  "comment", "mention", "document_uploaded",
  "appointment_created", "appointment_updated", "appointment_cancelled",
  "payment_dispute",
]);

function toNotificationType(raw: string): NotificationType | null {
  return VALID_NOTIFICATION_TYPES.has(raw) ? (raw as NotificationType) : null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function notificationIcon(type: NotificationType) {
  const cls = "h-4 w-4 shrink-0 mt-0.5";
  if (type.startsWith("case_")) return <Briefcase className={cn(cls, "text-blue-500")} />;
  if (type.startsWith("task_")) return <CheckSquare className={cn(cls, "text-violet-500")} />;
  if (type === "comment") return <MessageSquare className={cn(cls, "text-emerald-500")} />;
  if (type === "mention") return <AtSign className={cn(cls, "text-amber-500")} />;
  if (type === "document_uploaded") return <FileText className={cn(cls, "text-rose-500")} />;
  if (type === "payment_dispute") return <AlertTriangle className={cn(cls, "text-destructive")} />;
  if (type.startsWith("appointment_")) return <Bell className={cn(cls, "text-sky-500")} />;
  return <Bell className={cn(cls, "text-muted-foreground")} />;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter();
  const unreadCount = useQuery(api.notifications.queries.getUnreadCount) ?? 0;
  const notificationsRaw = useQuery(api.notifications.queries.list);
  const notifications = notificationsRaw ?? [];
  const markRead = useMutation(api.notifications.mutations.markRead);
  const markAllRead = useMutation(api.notifications.mutations.markAllRead);

  // Toast when a new notification arrives after initial load
  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (notificationsRaw === undefined) return; // still loading — don't initialise yet
    if (seenIds.current === null) {
      // First load — record existing IDs without toasting
      seenIds.current = new Set(notificationsRaw.map((n) => n._id));
      return;
    }
    for (const notif of notificationsRaw) {
      if (!seenIds.current.has(notif._id)) {
        toast(notif.title, { description: notif.message });
        playNotificationSound();
        seenIds.current.add(notif._id);
      }
    }
  }, [notificationsRaw]);

  async function handleClick(notif: (typeof notifications)[number]) {
    if (!notif.read) {
      await markRead({ id: notif._id as Id<"notifications"> });
    }
    const id = notif.entityId;
    const type = toNotificationType(notif.type);

    if (type === null) {
      // Unknown type from a future schema version — route to dashboard as safe fallback
      router.push("/dashboard");
      return;
    }

    if (type === "document_uploaded") {
      router.push(`/documents${id ? `?doc=${id}` : ""}`);
      return;
    }
    if (type === "case_created" || type === "case_assigned" || type === "case_status_changed" || type === "case_deadline" || type === "case_updated") {
      router.push(`/cases${id ? `?open=${id}` : ""}`);
      return;
    }
    if (type === "task_assigned" || type === "task_status_changed" || type === "task_overdue" || type === "task_updated") {
      router.push(`/tasks${id ? `?open=${id}` : ""}`);
      return;
    }
    if (type === "payment_dispute") {
      router.push("/payments");
      return;
    }
    if (type === "appointment_created" || type === "appointment_updated" || type === "appointment_cancelled") {
      router.push(`/appointments${id ? `?open=${id}` : ""}`);
      return;
    }
    // comment / mention — use entityType to determine destination
    if (notif.entityType === "case") router.push(`/cases${id ? `?open=${id}` : ""}`);
    else if (notif.entityType === "task") router.push(`/tasks${id ? `?open=${id}` : ""}`);
    else router.push("/dashboard");
  }

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full flex">
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full p-0 px-1 flex items-center justify-center text-[10px] leading-none bg-destructive text-white border-2 border-card">
              {badgeLabel}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[min(24rem,calc(100dvh-10rem))]">
            <div className="divide-y divide-border">
              {notifications.map((notif) => (
                <button
                  key={notif._id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                    !notif.read && "bg-primary/5"
                  )}
                >
                  {/* Icon */}
                  <div className="mt-0.5">
                    {notificationIcon(toNotificationType(notif.type) ?? "comment")}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-snug", !notif.read ? "font-semibold" : "font-medium")}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {relativeTime(notif._creationTime)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
