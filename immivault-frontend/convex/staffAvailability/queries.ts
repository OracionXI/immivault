import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

// ─── Timezone helpers ──────────────────────────────────────────────────────────

/**
 * Get the offset in milliseconds between local time (in `tz`) and UTC at a
 * specific UTC instant. Returns positive for timezones east of UTC (e.g. UTC+6
 * returns +6 * 3_600_000).
 */
function tzOffsetMs(tz: string, utcMs: number): number {
  const date = new Date(utcMs);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0");
  // hour can be "24" on some engines at midnight — clamp to 0
  const h = get("hour") % 24;
  const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), h, get("minute"), get("second"));
  return localMs - utcMs; // positive = east of UTC
}

/**
 * Return the UTC timestamp that corresponds to local midnight on `dateStr` in
 * `tz`, plus the local day-of-week (0=Sun…6=Sat) for that date.
 *
 * Uses noon UTC as the reference to determine the offset — avoids edge cases
 * where a DST transition falls exactly at midnight.
 */
function localMidnight(dateStr: string, tz: string): { midnightUTC: number; dayOfWeek: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const noonUTC = Date.UTC(y, m - 1, d, 12, 0, 0);
  const offset = tzOffsetMs(tz, noonUTC);
  // local midnight = UTC midnight shifted back by the offset
  const midnightUTC = Date.UTC(y, m - 1, d) - offset;
  // day-of-week at local noon (6 h after local midnight) — safe from DST issues
  const dayOfWeek = new Date(midnightUTC + 6 * 3_600_000).getUTCDay();
  return { midnightUTC, dayOfWeek };
}

/**
 * Admin / case manager: get all blackout date strings for a list of internal
 * attendees (staff users) within the same org. Used by the appointment modal
 * to disable those dates in the date picker.
 */
export const getBlackoutDatesForUsers = authenticatedQuery({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    if (args.userIds.length === 0) return [];
    const results = await Promise.all(
      args.userIds.map((userId) =>
        ctx.db
          .query("staffBlackoutDates")
          .withIndex("by_user", (q) => q.eq("userId", userId as Id<"users">))
          .collect()
      )
    );
    // Deduplicate date strings
    const dateSet = new Set<string>();
    for (const list of results) {
      for (const entry of list) {
        dateSet.add(entry.date);
      }
    }
    return Array.from(dateSet);
  },
});

/** Case manager / admin: list their own recurring weekly availability windows. */
export const getMyAvailability = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "case_manager") return [];
    return await ctx.db
      .query("staffAvailability")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
  },
});

/** Case manager / admin: list their own blackout dates. */
export const getMyBlackoutDates = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "case_manager") return [];
    return await ctx.db
      .query("staffBlackoutDates")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect()
      .then((list) => list.sort((a, b) => a.date.localeCompare(b.date)));
  },
});

/**
 * Internal: generate available 1-hour slot start timestamps (UTC) for a given
 * staff member on a specific calendar date.
 *
 * Slot hours are defined in the staff member's own timezone.
 * The frontend receives UTC timestamps and converts to the viewer's local timezone for display.
 *
 * @param userId        — the staff member whose availability to check
 * @param dateStartUTC  — UTC timestamp for midnight of the requested day in the STAFF'S TIMEZONE
 *                        (pre-computed by the portal HTTP action using Intl.DateTimeFormat)
 * @param dayOfWeek     — day of week (0=Sun…6=Sat) in the staff member's timezone
 * @param dateStr       — "YYYY-MM-DD" of the requested date in the staff's timezone (for blackout lookup)
 */
export const getAvailableSlotsForStaff = internalQuery({
  args: {
    organisationId: v.id("organisations"),
    userId: v.id("users"),
    dateStartUTC: v.number(), // kept for API compat, overridden by user timezone
    dayOfWeek: v.number(),    // kept for API compat, overridden by user timezone
    dateStr: v.string(),
  },
  handler: async (ctx, args) => {
    // Resolve the user's timezone and compute local midnight + day-of-week
    const user = await ctx.db.get(args.userId);
    // Guard: ensure the staff member belongs to the requested org
    if (!user || user.organisationId !== args.organisationId) return [];
    const tz = user?.timezone ?? "UTC";
    const { midnightUTC, dayOfWeek } = localMidnight(args.dateStr, tz);

    if (dayOfWeek < 0 || dayOfWeek > 6) return [];

    // Fetch active availability windows for this staff member on this day
    const windows = await ctx.db
      .query("staffAvailability")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then((list) => list.filter((w) => w.isActive && w.dayOfWeek === dayOfWeek));

    if (windows.length === 0) return [];

    // Check for a blackout date
    const blackout = await ctx.db
      .query("staffBlackoutDates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then((list) => list.find((b) => b.date === args.dateStr));

    if (blackout) return [];

    // Fetch exclusion windows for this day — hours to subtract from availability
    const exclusions = await ctx.db
      .query("staffAvailabilityExclusions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then((list) => list.filter((e) => e.dayOfWeek === dayOfWeek));

    // Build a set of excluded hours (each hour whose start is within an exclusion window)
    const excludedHours = new Set<number>();
    for (const ex of exclusions) {
      for (let h = ex.startHour; h < ex.endHour; h++) excludedHours.add(h);
    }

    const now = Date.now();
    const minBookAhead = now + 60 * 60_000;
    const maxBookAhead = now + 60 * 24 * 60 * 60_000;

    // Generate 1-hour slots: convert local hours to UTC using the admin's timezone
    const slotStarts: number[] = [];
    for (const window of windows) {
      for (let hour = window.startHour; hour < window.endHour; hour++) {
        if (excludedHours.has(hour)) continue;
        const slotUTC = midnightUTC + hour * 3_600_000;
        if (slotUTC < minBookAhead) continue;
        if (slotUTC > maxBookAhead) continue;
        slotStarts.push(slotUTC);
      }
    }

    if (slotStarts.length === 0) return [];

    // Exclude slots where this staff member already has an appointment
    const dayEnd = midnightUTC + 24 * 3_600_000;
    const booked = await ctx.db
      .query("appointments")
      .withIndex("by_assigned", (q) => q.eq("assignedTo", args.userId))
      .collect()
      .then((list) =>
        list.filter(
          (a) =>
            a.startAt >= midnightUTC &&
            a.startAt < dayEnd &&
            a.status !== "Cancelled" &&
            a.status !== "Expired"
        )
      );

    const bookedSet = new Set(booked.map((a) => a.startAt));
    return slotStarts.filter((s) => !bookedSet.has(s));
  },
});

/**
 * Internal: generate merged available 1-hour slot UTC timestamps across ALL admins
 * in an organisation for a given date. A slot is available if at least one admin
 * is free at that time (not booked and not excluded).
 *
 * Used by the public prospect appointment request page so prospects can only pick
 * times when at least one admin is actually available.
 *
 * @param dateStr       "YYYY-MM-DD" in UTC (used for blackout lookup per admin)
 * @param dateStartUTC  UTC ms of midnight for the requested date
 * @param dayOfWeek     0–6 (Sunday–Saturday)
 */
export const getMergedAdminSlots = internalQuery({
  args: {
    organisationId: v.id("organisations"),
    dateStr: v.string(),
    dateStartUTC: v.number(),
    dayOfWeek: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.dayOfWeek < 0 || args.dayOfWeek > 6) return [];

    // Fetch all active admins in the org
    const admins = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect()
      .then((list) => list.filter((u) => u.role === "admin" && u.status === "active"));

    if (admins.length === 0) return [];

    const now = Date.now();
    const minBookAhead = now + 60 * 60_000;
    const maxBookAhead = now + 60 * 24 * 60 * 60_000;
    const dayEnd = args.dateStartUTC + 24 * 3_600_000;

    // For each admin, compute their available slot hours using their own timezone
    const availableSlotSets = await Promise.all(
      admins.map(async (admin) => {
        // Resolve per-admin timezone → local midnight + local day-of-week
        const tz = admin.timezone ?? "UTC";
        const { midnightUTC: adminMidnight, dayOfWeek: adminDow } = localMidnight(args.dateStr, tz);
        const adminDayEnd = adminMidnight + 24 * 3_600_000;

        // Check blackout
        const blackout = await ctx.db
          .query("staffBlackoutDates")
          .withIndex("by_user", (q) => q.eq("userId", admin._id))
          .collect()
          .then((list) => list.find((b) => b.date === args.dateStr));
        if (blackout) return new Set<number>();

        // Availability windows for this admin's local day-of-week
        const windows = await ctx.db
          .query("staffAvailability")
          .withIndex("by_user", (q) => q.eq("userId", admin._id))
          .collect()
          .then((list) => list.filter((w) => w.isActive && w.dayOfWeek === adminDow));
        if (windows.length === 0) return new Set<number>();

        // Exclusions for this day
        const exclusions = await ctx.db
          .query("staffAvailabilityExclusions")
          .withIndex("by_user", (q) => q.eq("userId", admin._id))
          .collect()
          .then((list) => list.filter((e) => e.dayOfWeek === adminDow));
        const excludedHours = new Set<number>();
        for (const ex of exclusions) {
          for (let h = ex.startHour; h < ex.endHour; h++) excludedHours.add(h);
        }

        // Existing bookings for this admin on this local day
        const booked = await ctx.db
          .query("appointments")
          .withIndex("by_assigned", (q) => q.eq("assignedTo", admin._id))
          .collect()
          .then((list) =>
            list.filter(
              (a) =>
                a.startAt >= adminMidnight &&
                a.startAt < adminDayEnd &&
                a.status !== "Cancelled" &&
                a.status !== "Expired"
            )
          );
        const bookedSet = new Set(booked.map((a) => a.startAt));

        // Build available slot UTC timestamps — local hour → UTC via admin's timezone
        const slots = new Set<number>();
        for (const w of windows) {
          for (let hour = w.startHour; hour < w.endHour; hour++) {
            if (excludedHours.has(hour)) continue;
            const slotUTC = adminMidnight + hour * 3_600_000;
            if (slotUTC < minBookAhead) continue;
            if (slotUTC > maxBookAhead) continue;
            if (bookedSet.has(slotUTC)) continue;
            slots.add(slotUTC);
          }
        }
        return slots;
      })
    );

    // Union of all admin slot sets — a slot is available if at least one admin is free
    const merged = new Set<number>();
    for (const set of availableSlotSets) {
      for (const slot of set) merged.add(slot);
    }

    return Array.from(merged).sort((a, b) => a - b);
  },
});

/** Internal: get a staff member's timezone string (falls back to "UTC"). */
export const getStaffTimezone = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.timezone ?? "UTC";
  },
});
