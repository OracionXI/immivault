import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

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
 * Internal: orgs that were soft-deleted more than `cutoff` ms ago.
 * Used by the daily purge cron to find orgs eligible for permanent deletion.
 */
export const listExpired = internalQuery({
  args: { cutoff: v.number() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("organisations").collect();
    return all.filter((o) => o.deletedAt !== undefined && o.deletedAt <= args.cutoff);
  },
});

/**
 * Internal: returns organisation settings by org ID.
 * Used by actions that cannot call the authenticated getSettings query.
 */
export const getSettingsInternal = internalQuery({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId as Id<"organisations">))
      .unique();
  },
});

/**
 * Returns the organisation settings for the current user's org.
 * Sensitive Stripe credentials are redacted — presence is indicated by boolean flags.
 */
export const getSettings = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const s = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .unique();
    if (!s) return null;
    // Never send secret key material to the frontend
    const { stripeSecretKey, stripeWebhookSecret, stripeSecretKeyEnc, stripeWebhookSecretEnc, ...safe } = s;
    return {
      ...safe,
      stripeSecretKey: !!(stripeSecretKey || stripeSecretKeyEnc) ? "REDACTED" as const : undefined,
      stripeWebhookSecret: !!(stripeWebhookSecret || stripeWebhookSecretEnc) ? "REDACTED" as const : undefined,
    };
  },
});
