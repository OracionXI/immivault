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
 * Internal: look up a user by JWT tokenIdentifier.
 * Used by actions that verify auth without the custom wrapper.
 */
export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.token))
      .unique();
  },
});

/**
 * Internal: look up a user by Convex document ID.
 * Used by the deleteStaff action.
 */
export const getById = internalQuery({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Internal: list all active admin users in an organisation.
 * Used by the onCaseCreated notification action.
 */
/** Internal: all users in an org (no auth). Used by purgeExpiredOrgs. */
export const listByOrgInternal = internalQuery({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();
  },
});

export const listAdminsByOrg = internalQuery({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();
    return users.filter((u) => u.role === "admin" && u.status === "active");
  },
});

export const listNonAdminsByOrg = internalQuery({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();
    return users.filter(
      (u) => (u.role === "case_manager" || u.role === "staff") && u.status === "active"
    );
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

/** Returns the most recent pending invitation for an email within an org, or null. */
export const getInviteByEmail = internalQuery({
  args: { organisationId: v.id("organisations"), email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) =>
        q.and(
          q.eq(q.field("organisationId"), args.organisationId),
          q.eq(q.field("used"), false)
        )
      )
      .order("desc")
      .first();
  },
});
