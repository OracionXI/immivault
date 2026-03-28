import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/**
 * Admin: replace all availability windows for a given appointment pricing type.
 * Each entry represents a recurring weekly window (day + start/end hours in org timezone).
 */
export const upsertAvailability = authenticatedMutation({
  args: {
    appointmentPricingId: v.id("appointmentPricing"),
    windows: v.array(v.object({
      dayOfWeek: v.number(), // 0=Sun … 6=Sat
      startHour: v.number(), // 0–23
      endHour: v.number(),   // 1–24 (exclusive)
      isActive: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    const pricing = await ctx.db.get(args.appointmentPricingId);
    if (!pricing || pricing.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment pricing not found." });
    }

    // Validate input
    for (const w of args.windows) {
      if (w.dayOfWeek < 0 || w.dayOfWeek > 6 || !Number.isInteger(w.dayOfWeek))
        throw new ConvexError({ code: "BAD_REQUEST", message: "dayOfWeek must be 0–6." });
      if (w.startHour < 0 || w.startHour > 23 || !Number.isInteger(w.startHour))
        throw new ConvexError({ code: "BAD_REQUEST", message: "startHour must be 0–23." });
      if (w.endHour < 1 || w.endHour > 24 || !Number.isInteger(w.endHour))
        throw new ConvexError({ code: "BAD_REQUEST", message: "endHour must be 1–24." });
      if (w.endHour <= w.startHour)
        throw new ConvexError({ code: "BAD_REQUEST", message: "endHour must be after startHour." });
    }

    // Delete existing windows for this pricing
    const existing = await ctx.db
      .query("appointmentAvailability")
      .withIndex("by_pricing", (q) => q.eq("appointmentPricingId", args.appointmentPricingId))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);

    // Insert new windows
    for (const w of args.windows) {
      if (!w.isActive) continue; // skip inactive entries
      await ctx.db.insert("appointmentAvailability", {
        organisationId: ctx.user.organisationId,
        appointmentPricingId: args.appointmentPricingId,
        dayOfWeek: w.dayOfWeek,
        startHour: w.startHour,
        endHour: w.endHour,
        isActive: true,
      });
    }
  },
});
