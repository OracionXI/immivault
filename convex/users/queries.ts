import { authenticatedQuery } from "../lib/auth";
import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Non-throwing version — returns null if user is unauthenticated or not yet
 * synced to Convex. Used by InitGate to detect first-run without crashing.
 */
export const tryGetCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
  },
});

/**
 * Returns the currently authenticated user's full profile.
 */
export const me = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.user;
  },
});

/**
 * Lists all active staff members in the caller's organisation.
 */
export const listByOrg = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .withIndex("by_org", (q) =>
        q.eq("organisationId", ctx.user.organisationId)
      )
      .collect();
  },
});

/**
 * Internal: look up a user by their Clerk user ID.
 * Used in the webhook handler.
 */
export const getByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) =>
        q.eq("clerkUserId", args.clerkUserId)
      )
      .unique();
  },
});
