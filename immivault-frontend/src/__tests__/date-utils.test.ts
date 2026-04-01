/**
 * Tests for date & deadline utility logic used across Ordena.
 *
 * Mirrors the pure date calculations in:
 *   - convex/tasks/mutations.ts     (overdue detection)
 *   - convex/cases/mutations.ts     (deadline checks)
 *   - convex/appointments/queries.ts (upcoming window)
 *   - convex/notifications/actions.ts (document expiry, reminder windows)
 *   - convex/dashboard/queries.ts   (today's appointments, 7-day window)
 *
 * All timestamps are Unix epoch milliseconds.
 * No Convex ctx.db — pure logic only.
 */

import { describe, it, expect } from "vitest";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

// ─── Helpers (mirrors date logic scattered across Convex functions) ───────────

/** A task is overdue when its dueDate is before now. */
function isTaskOverdue(dueDate: number, now = Date.now()): boolean {
  return dueDate < now;
}

/** Returns days remaining until a deadline (negative if past). */
function daysUntilDeadline(deadline: number, now = Date.now()): number {
  return Math.ceil((deadline - now) / DAY_MS);
}

/** An appointment falls within the "upcoming 7-day" dashboard window. */
function isUpcomingThisWeek(startAt: number, now = Date.now()): boolean {
  return startAt >= now && startAt <= now + 7 * DAY_MS;
}

/** Returns true if the given timestamp is on the same calendar day as now (UTC). */
function isToday(ts: number, now = Date.now()): boolean {
  const d1 = new Date(ts);
  const d2 = new Date(now);
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
}

/** Document expiry: returns true if expiry is within the given notice window (days). */
function isExpiryWithinNoticeWindow(
  expiryDate: number,
  noticeDays: number,
  now = Date.now()
): boolean {
  return expiryDate > now && expiryDate <= now + noticeDays * DAY_MS;
}

/** Appointment reminder: appointment is within the next `hours` hours. */
function isWithinReminderWindow(
  startAt: number,
  reminderHours: number,
  now = Date.now()
): boolean {
  return startAt > now && startAt <= now + reminderHours * HOUR_MS;
}

/** Returns the start-of-day (midnight UTC) for a given timestamp. */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/** Format a deadline for display: "X days", "Today", "Overdue by X days" */
function formatDeadlineLabel(deadline: number, now = Date.now()): string {
  const days = daysUntilDeadline(deadline, now);
  if (days === 0) return "Today";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"}`;
  return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
}

// ─── isTaskOverdue ────────────────────────────────────────────────────────────

describe("isTaskOverdue", () => {
  it("returns true when dueDate is in the past", () => {
    const now = Date.now();
    expect(isTaskOverdue(now - DAY_MS, now)).toBe(true);
  });

  it("returns false when dueDate is in the future", () => {
    const now = Date.now();
    expect(isTaskOverdue(now + DAY_MS, now)).toBe(false);
  });

  it("returns true when dueDate is exactly now (millisecond boundary)", () => {
    const now = Date.now();
    expect(isTaskOverdue(now - 1, now)).toBe(true);
  });

  it("returns false for a deadline one hour from now", () => {
    const now = Date.now();
    expect(isTaskOverdue(now + HOUR_MS, now)).toBe(false);
  });

  it("returns true for a task due 30 days ago", () => {
    const now = Date.now();
    expect(isTaskOverdue(now - 30 * DAY_MS, now)).toBe(true);
  });
});

// ─── daysUntilDeadline ────────────────────────────────────────────────────────

describe("daysUntilDeadline", () => {
  it("returns a positive number for a future deadline", () => {
    const now = Date.now();
    expect(daysUntilDeadline(now + 5 * DAY_MS, now)).toBe(5);
  });

  it("returns a negative number for a past deadline", () => {
    const now = Date.now();
    expect(daysUntilDeadline(now - 3 * DAY_MS, now)).toBe(-3);
  });

  it("returns 1 for a deadline less than 24h away (ceiling)", () => {
    const now = Date.now();
    expect(daysUntilDeadline(now + HOUR_MS, now)).toBe(1);
  });

  it("returns 0 for a deadline exactly now", () => {
    const now = Date.now();
    // ceil(0) = 0
    expect(daysUntilDeadline(now, now)).toBe(0);
  });

  it("returns 30 for a deadline exactly 30 days away", () => {
    const now = Date.now();
    expect(daysUntilDeadline(now + 30 * DAY_MS, now)).toBe(30);
  });
});

// ─── isUpcomingThisWeek ───────────────────────────────────────────────────────

describe("isUpcomingThisWeek", () => {
  it("includes an appointment 3 days from now", () => {
    const now = Date.now();
    expect(isUpcomingThisWeek(now + 3 * DAY_MS, now)).toBe(true);
  });

  it("includes an appointment exactly 7 days from now", () => {
    const now = Date.now();
    expect(isUpcomingThisWeek(now + 7 * DAY_MS, now)).toBe(true);
  });

  it("excludes an appointment 8 days from now", () => {
    const now = Date.now();
    expect(isUpcomingThisWeek(now + 8 * DAY_MS, now)).toBe(false);
  });

  it("excludes a past appointment", () => {
    const now = Date.now();
    expect(isUpcomingThisWeek(now - HOUR_MS, now)).toBe(false);
  });

  it("includes an appointment 1 hour from now", () => {
    const now = Date.now();
    expect(isUpcomingThisWeek(now + HOUR_MS, now)).toBe(true);
  });

  it("excludes an appointment that is right now (already started)", () => {
    const now = Date.now();
    expect(isUpcomingThisWeek(now - 1, now)).toBe(false);
  });
});

// ─── isToday ──────────────────────────────────────────────────────────────────

describe("isToday", () => {
  it("returns true for a timestamp earlier the same UTC day", () => {
    const now = Date.now();
    const sameDay = startOfDay(now) + HOUR_MS; // 01:00 UTC today
    expect(isToday(sameDay, now)).toBe(true);
  });

  it("returns false for yesterday", () => {
    const now = Date.now();
    expect(isToday(now - DAY_MS, now)).toBe(false);
  });

  it("returns false for tomorrow", () => {
    const now = Date.now();
    expect(isToday(now + DAY_MS, now)).toBe(false);
  });

  it("returns true for the same millisecond", () => {
    const now = Date.now();
    expect(isToday(now, now)).toBe(true);
  });
});

// ─── isExpiryWithinNoticeWindow ───────────────────────────────────────────────

describe("isExpiryWithinNoticeWindow", () => {
  it("flags a document expiring in 10 days with a 30-day notice window", () => {
    const now = Date.now();
    expect(isExpiryWithinNoticeWindow(now + 10 * DAY_MS, 30, now)).toBe(true);
  });

  it("ignores a document expiring in 60 days with a 30-day window", () => {
    const now = Date.now();
    expect(isExpiryWithinNoticeWindow(now + 60 * DAY_MS, 30, now)).toBe(false);
  });

  it("ignores an already-expired document", () => {
    const now = Date.now();
    expect(isExpiryWithinNoticeWindow(now - DAY_MS, 30, now)).toBe(false);
  });

  it("flags a document expiring exactly at the window boundary", () => {
    const now = Date.now();
    expect(isExpiryWithinNoticeWindow(now + 30 * DAY_MS, 30, now)).toBe(true);
  });

  it("uses a 7-day short notice window correctly", () => {
    const now = Date.now();
    expect(isExpiryWithinNoticeWindow(now + 5 * DAY_MS, 7, now)).toBe(true);
    expect(isExpiryWithinNoticeWindow(now + 8 * DAY_MS, 7, now)).toBe(false);
  });
});

// ─── isWithinReminderWindow ───────────────────────────────────────────────────

describe("isWithinReminderWindow (appointment reminders)", () => {
  it("triggers for an appointment 1 hour away with a 24h window", () => {
    const now = Date.now();
    expect(isWithinReminderWindow(now + HOUR_MS, 24, now)).toBe(true);
  });

  it("does not trigger for an appointment 2 days away with a 24h window", () => {
    const now = Date.now();
    expect(isWithinReminderWindow(now + 2 * DAY_MS, 24, now)).toBe(false);
  });

  it("does not trigger for a past appointment", () => {
    const now = Date.now();
    expect(isWithinReminderWindow(now - HOUR_MS, 24, now)).toBe(false);
  });

  it("triggers at exactly the window boundary", () => {
    const now = Date.now();
    expect(isWithinReminderWindow(now + 24 * HOUR_MS, 24, now)).toBe(true);
  });
});

// ─── startOfDay ───────────────────────────────────────────────────────────────

describe("startOfDay", () => {
  it("returns midnight UTC for a midday timestamp", () => {
    const midday = new Date("2025-06-15T12:00:00Z").getTime();
    const midnight = new Date("2025-06-15T00:00:00Z").getTime();
    expect(startOfDay(midday)).toBe(midnight);
  });

  it("returns the same value when given a midnight timestamp", () => {
    const midnight = new Date("2025-01-01T00:00:00Z").getTime();
    expect(startOfDay(midnight)).toBe(midnight);
  });
});

// ─── formatDeadlineLabel ──────────────────────────────────────────────────────

describe("formatDeadlineLabel", () => {
  it("returns 'Today' for a deadline at exactly now", () => {
    const now = Date.now();
    expect(formatDeadlineLabel(now, now)).toBe("Today");
  });

  it("returns '1 day' for a deadline less than 24h away", () => {
    const now = Date.now();
    expect(formatDeadlineLabel(now + HOUR_MS, now)).toBe("1 day");
  });

  it("returns '5 days' for a deadline 5 days away", () => {
    const now = Date.now();
    expect(formatDeadlineLabel(now + 5 * DAY_MS, now)).toBe("5 days");
  });

  it("uses singular 'day' for exactly 1 day", () => {
    const now = Date.now();
    expect(formatDeadlineLabel(now + DAY_MS, now)).toBe("1 day");
  });

  it("returns 'Overdue by 1 day' for a deadline just over 24h ago", () => {
    const now = Date.now();
    // -25h → ceil(-25/24) = -1 → abs = 1
    expect(formatDeadlineLabel(now - 25 * HOUR_MS, now)).toBe("Overdue by 1 day");
  });

  it("returns 'Overdue by 3 days' for a deadline 3+ days ago", () => {
    const now = Date.now();
    expect(formatDeadlineLabel(now - 3 * DAY_MS - MINUTE_MS, now)).toBe(
      "Overdue by 3 days"
    );
  });
});
