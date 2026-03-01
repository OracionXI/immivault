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
 * Internal: look up an organisation by Clerk org ID.
 * Used in the webhook handler.
 */
export const getByClerkOrgId = internalQuery({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organisations")
      .withIndex("by_clerk_org", (q) =>
        q.eq("clerkOrgId", args.clerkOrgId)
      )
      .unique();
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
