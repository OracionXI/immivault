import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Returns the organisation the current user belongs to.
 */
export const mine = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.get(ctx.user.organisationId);
  },
});

/**
 * Internal: look up an organisation by its Convex document ID.
 */
export const getById = internalQuery({
  args: { id: v.id("organisations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Internal: returns the first organisation in the database.
 * Used as a fallback when a new admin signs up without invitation metadata.
 */
export const getFirst = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organisations").first();
  },
});

/**
 * Returns the organisation settings for the current user's org.
 */
export const getSettings = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .unique();
  },
});
