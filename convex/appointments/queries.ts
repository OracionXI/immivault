import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/** All appointments in the org. */
export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("appointments")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .order("desc")
      .collect();
  },
});

/** Upcoming appointments (Scheduled or Confirmed) ordered by start time. */
export const listUpcoming = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const scheduled = await ctx.db
      .query("appointments")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", ctx.user.organisationId).eq("status", "Scheduled")
      )
      .collect();
    const confirmed = await ctx.db
      .query("appointments")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", ctx.user.organisationId).eq("status", "Confirmed")
      )
      .collect();
    return [...scheduled, ...confirmed]
      .filter((a) => a.startAt >= now)
      .sort((a, b) => a.startAt - b.startAt);
  },
});

/** Single appointment by ID. */
export const get = authenticatedQuery({
  args: { id: v.id("appointments") },
  handler: async (ctx, args) => {
    const appt = await ctx.db.get(args.id);
    if (!appt || appt.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment not found." });
    }
    return appt;
  },
});
