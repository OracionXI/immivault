import { internalMutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/**
 * Called by the Clerk webhook when a new organisation is created in Clerk.
 * Creates the matching Convex organisation record.
 */
export const createFromClerk = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    // Prevent duplicates
    const existing = await ctx.db
      .query("organisations")
      .withIndex("by_clerk_org", (q) =>
        q.eq("clerkOrgId", args.clerkOrgId)
      )
      .unique();

    if (existing) return existing._id;

    const orgId = await ctx.db.insert("organisations", {
      clerkOrgId: args.clerkOrgId,
      name: args.name,
      slug: args.slug,
      plan: "free",
    });

    // Seed default organisation settings
    await ctx.db.insert("organisationSettings", {
      organisationId: orgId,
      defaultCurrency: "USD",
      taxRate: 0,
      bookingEnabled: false,
    });

    return orgId;
  },
});

/** Updates the organisation's settings record. Admin only. */
export const updateSettings = authenticatedMutation({
  args: {
    caseStages: v.optional(v.array(v.string())),
    defaultCurrency: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    emailFromName: v.optional(v.string()),
    emailFromAddress: v.optional(v.string()),
    bookingEnabled: v.optional(v.boolean()),
    bookingUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    const settings = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .unique();
    if (!settings) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisation settings not found." });
    }
    await ctx.db.patch(settings._id, args);
  },
});
