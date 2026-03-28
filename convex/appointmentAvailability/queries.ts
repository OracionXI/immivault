import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/** Admin: list all availability windows for a specific appointment pricing type. */
export const listByPricing = authenticatedQuery({
  args: { appointmentPricingId: v.id("appointmentPricing") },
  handler: async (ctx, args) => {
    const pricing = await ctx.db.get(args.appointmentPricingId);
    if (!pricing || pricing.organisationId !== ctx.user.organisationId) return [];
    return await ctx.db
      .query("appointmentAvailability")
      .withIndex("by_pricing", (q) => q.eq("appointmentPricingId", args.appointmentPricingId))
      .collect();
  },
});

/**
 * Internal: generate available 1-hour slot start timestamps (UTC) for a given
 * appointment pricing type on a specific calendar date.
 *
 * Slot hours are defined in the org's timezone; conversion to UTC is done here.
 * The frontend receives UTC timestamps and converts to the client's local timezone for display.
 *
 * @param dateStartUTC  — UTC timestamp for midnight of the requested day IN THE ORG'S TIMEZONE
 *                        (pre-computed by the portal API route using Intl.DateTimeFormat)
 * @param dayOfWeek     — day of week (0=Sun…6=Sat) in the org's timezone for that date
 *                        (pre-computed by the portal API route)
 * @param orgTimezoneOffsetMs — offset from UTC to org local time in ms
 *                        (pre-computed by the portal API route)
 */
export const getAvailableSlots = internalQuery({
  args: {
    organisationId: v.id("organisations"),
    appointmentPricingId: v.id("appointmentPricing"),
    /** UTC ms of midnight (start of day) in the org's timezone for the requested date. */
    dateStartUTC: v.number(),
    /** Day of week (0–6) in the org's timezone. */
    dayOfWeek: v.number(),
  },
  handler: async (ctx, args) => {
    // Fetch availability windows active for this day
    const avail = await ctx.db
      .query("appointmentAvailability")
      .withIndex("by_pricing", (q) => q.eq("appointmentPricingId", args.appointmentPricingId))
      .collect()
      .then((list) => list.filter((a) => a.isActive && a.dayOfWeek === args.dayOfWeek));

    if (avail.length === 0) return [];

    const now = Date.now();
    const minBookAhead = now + 60 * 60 * 1000;         // 1hr from now minimum
    const maxBookAhead = now + 30 * 24 * 60 * 60 * 1000; // 30 days max

    // Generate 1-hour slots from each availability window
    const slotStarts: number[] = [];
    for (const window of avail) {
      for (let hour = window.startHour; hour < window.endHour; hour++) {
        const slotUTC = args.dateStartUTC + hour * 3_600_000;
        if (slotUTC < minBookAhead) continue;
        if (slotUTC > maxBookAhead) continue;
        slotStarts.push(slotUTC);
      }
    }

    if (slotStarts.length === 0) return [];

    // Exclude slots where an appointment already starts
    const dayEnd = args.dateStartUTC + 24 * 3_600_000;
    const booked = await ctx.db
      .query("appointments")
      .withIndex("by_org_and_start", (q) =>
        q.eq("organisationId", args.organisationId)
         .gte("startAt", args.dateStartUTC)
      )
      .filter((q) => q.lt(q.field("startAt"), dayEnd))
      .collect()
      .then((list) => list.filter((a) => a.status !== "Cancelled" && a.status !== "Expired"));

    const bookedSet = new Set(booked.map((a) => a.startAt));
    return slotStarts.filter((s) => !bookedSet.has(s));
  },
});

/**
 * Internal: generate available 1-hour offline slot start timestamps (UTC) for a given date.
 * Uses the org's officeHours setting (from organisationSettings) instead of per-pricing windows.
 */
export const getOfflineSlots = internalQuery({
  args: {
    organisationId: v.id("organisations"),
    dateStartUTC: v.number(),
    dayOfWeek: v.number(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .unique();

    const windows = (settings?.officeHours ?? []).filter(
      (w) => w.isActive && w.dayOfWeek === args.dayOfWeek
    );
    if (windows.length === 0) return [];

    const now = Date.now();
    const minBookAhead = now + 60 * 60 * 1000;
    const maxBookAhead = now + 30 * 24 * 60 * 60 * 1000;

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

    // Exclude already-booked slots
    const dayEnd = args.dateStartUTC + 24 * 3_600_000;
    const booked = await ctx.db
      .query("appointments")
      .withIndex("by_org_and_start", (q) =>
        q.eq("organisationId", args.organisationId).gte("startAt", args.dateStartUTC)
      )
      .filter((q) => q.lt(q.field("startAt"), dayEnd))
      .collect()
      .then((list) => list.filter((a) => a.status !== "Cancelled" && a.status !== "Expired"));

    const bookedSet = new Set(booked.map((a) => a.startAt));
    return slotStarts.filter((s) => !bookedSet.has(s));
  },
});

/** Internal: return all active pricing types for an org that have at least one availability window. */
export const getPricingWithAvailability = internalQuery({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const allAvail = await ctx.db
      .query("appointmentAvailability")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect()
      .then((list) => list.filter((a) => a.isActive));

    const pricingIdsWithAvail = new Set(allAvail.map((a) => a.appointmentPricingId));

    const pricing = await ctx.db
      .query("appointmentPricing")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect()
      .then((list) => list.filter((p) => p.isActive && pricingIdsWithAvail.has(p._id)));

    return pricing;
  },
});
