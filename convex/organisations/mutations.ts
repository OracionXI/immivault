import { internalMutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/**
 * Gets the existing organisation or creates a default one.
 * Called by the user.created webhook for the first admin signup
 * when there is no organisationId in the Clerk user's public_metadata.
 */
export const getOrCreateDefault = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("organisations").first();
    if (existing) return existing._id;

    const orgId = await ctx.db.insert("organisations", {
      name: "My Organisation",
      slug: "my-organisation",
      plan: "free",
    });

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
    slotDuration: v.optional(v.number()),
    bufferTime: v.optional(v.number()),
    availableStartTime: v.optional(v.string()),
    availableEndTime: v.optional(v.string()),
    availableDays: v.optional(v.array(v.string())),
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
