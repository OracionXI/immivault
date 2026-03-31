import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/** Case manager / admin: list their own recurring exclusion windows. */
export const getMyExclusions = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "case_manager") return [];
    return await ctx.db
      .query("staffAvailabilityExclusions")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
  },
});

/**
 * Internal: fetch exclusion windows for a specific staff member on a given day of week.
 * Used by slot generation to subtract blocked hours from availability windows.
 */
export const getExclusionsForUser = internalQuery({
  args: {
    userId: v.id("users"),
    dayOfWeek: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("staffAvailabilityExclusions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then((list) => list.filter((e) => e.dayOfWeek === args.dayOfWeek));
  },
});
