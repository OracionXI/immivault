import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

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
    dateStartUTC: v.number(),
    dayOfWeek: v.number(),
    dateStr: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch active availability windows for this staff member on this day
    const windows = await ctx.db
      .query("staffAvailability")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then((list) => list.filter((w) => w.isActive && w.dayOfWeek === args.dayOfWeek));

    if (windows.length === 0) return [];

    // Check for a blackout date
    const blackout = await ctx.db
      .query("staffBlackoutDates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then((list) => list.find((b) => b.date === args.dateStr));

    if (blackout) return [];

    const now = Date.now();
    const minBookAhead = now + 60 * 60_000;              // 1 hr minimum
    const maxBookAhead = now + 60 * 24 * 60 * 60_000;   // 60 days maximum

    // Generate 1-hour slots from each window
    const slotStarts: number[] = [];
    for (const window of windows) {
      for (let hour = window.startHour; hour < window.endHour; hour++) {
        const slotUTC = args.dateStartUTC + hour * 3_600_000;
        if (slotUTC < minBookAhead) continue;
        if (slotUTC > maxBookAhead) continue;
        slotStarts.push(slotUTC);
      }
    }

    if (slotStarts.length === 0) return [];

    // Exclude slots where this staff member already has an appointment (any non-cancelled/expired status,
    // including PendingApproval — a pending booking holds the slot until declined)
    const dayEnd = args.dateStartUTC + 24 * 3_600_000;
    const booked = await ctx.db
      .query("appointments")
      .withIndex("by_assigned", (q) => q.eq("assignedTo", args.userId))
      .collect()
      .then((list) =>
        list.filter(
          (a) =>
            a.startAt >= args.dateStartUTC &&
            a.startAt < dayEnd &&
            a.status !== "Cancelled" &&
            a.status !== "Expired"
        )
      );

    const bookedSet = new Set(booked.map((a) => a.startAt));
    return slotStarts.filter((s) => !bookedSet.has(s));
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
