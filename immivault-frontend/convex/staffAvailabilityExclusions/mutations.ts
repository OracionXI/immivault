import { authenticatedMutation } from "../lib/auth";
import { v, ConvexError } from "convex/values";

/**
 * Replace all exclusion windows for the calling staff member on a specific day.
 * Pass an empty array to clear all exclusions for that day.
 */
export const upsertExclusions = authenticatedMutation({
  args: {
    dayOfWeek: v.number(),  // 0–6
    windows: v.array(v.object({
      startHour: v.number(),  // 0–23
      endHour: v.number(),    // 1–24 (exclusive)
    })),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "case_manager") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not authorised." });
    }
    if (args.dayOfWeek < 0 || args.dayOfWeek > 6) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "dayOfWeek must be 0–6." });
    }
    for (const w of args.windows) {
      if (w.startHour < 0 || w.startHour > 23)
        throw new ConvexError({ code: "BAD_REQUEST", message: "startHour must be 0–23." });
      if (w.endHour < 1 || w.endHour > 24)
        throw new ConvexError({ code: "BAD_REQUEST", message: "endHour must be 1–24." });
      if (w.endHour <= w.startHour)
        throw new ConvexError({ code: "BAD_REQUEST", message: "endHour must be greater than startHour." });
      if (w.endHour - w.startHour < 1)
        throw new ConvexError({ code: "BAD_REQUEST", message: "Exclusion window must be at least 1 hour." });
    }

    // Delete existing exclusions for this user + day
    const existing = await ctx.db
      .query("staffAvailabilityExclusions")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect()
      .then((list) => list.filter((e) => e.dayOfWeek === args.dayOfWeek));

    await Promise.all(existing.map((e) => ctx.db.delete(e._id)));

    // Insert new windows
    await Promise.all(
      args.windows.map((w) =>
        ctx.db.insert("staffAvailabilityExclusions", {
          organisationId: ctx.user.organisationId,
          userId: ctx.user._id,
          dayOfWeek: args.dayOfWeek,
          startHour: w.startHour,
          endHour: w.endHour,
        })
      )
    );
  },
});
