import { internalMutation, mutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/**
 * Gets the existing organisation or creates a default one.
 * Called by the user.created webhook for the first admin signup
 * when there is no organisationId in the Clerk user's public_metadata.
 * Creates a temporary placeholder — the real name is set in /onboarding.
 */
export const getOrCreateDefault = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("organisations").first();
    if (existing) return existing._id;

    const orgId = await ctx.db.insert("organisations", {
      name: "Pending Setup",
      slug: "pending-setup",
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

/**
 * Completes the onboarding flow for a manual admin signup.
 * This is a raw mutation (not authenticatedMutation) because the user
 * is still in "pending_onboarding" status when they call it.
 *
 * - Verifies the caller is authenticated and in pending_onboarding status
 * - Updates the organisation name, slug, and agreement details
 * - Sets the user status to "active"
 */
export const completeOnboarding = mutation({
  args: {
    orgName: v.string(),
    agreementSignature: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated." });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "USER_NOT_FOUND",
        message: "User profile not found. Please contact support.",
      });
    }

    if (user.status !== "pending_onboarding") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Onboarding already completed.",
      });
    }

    const orgName = args.orgName.trim();
    if (orgName.length < 2) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Organisation name must be at least 2 characters.",
      });
    }

    // Generate a URL-safe slug from the org name
    const baseSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);

    // Ensure slug uniqueness by appending a counter if necessary
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await ctx.db
        .query("organisations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (!existing || existing._id === user.organisationId) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Update organisation with the real name and agreement record
    await ctx.db.patch(user.organisationId, {
      name: orgName,
      slug,
      agreementSignature: args.agreementSignature,
      agreementSignedAt: Date.now(),
    });

    // Activate the user
    await ctx.db.patch(user._id, { status: "active" });
  },
});

/** Updates the organisation's settings record. Admin only. */
export const updateSettings = authenticatedMutation({
  args: {
    caseStages: v.optional(v.array(v.string())),
    caseColumnOrder: v.optional(v.array(v.string())),
    caseTypes: v.optional(v.array(
      v.object({ id: v.string(), name: v.string(), issues: v.array(v.string()) })
    )),
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

/**
 * Internal: permanently cascade-deletes all Convex data for an organisation.
 * Called by purgeExpiredOrgs after Clerk users have been removed.
 */
export const permanentDeleteOrg = internalMutation({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const { organisationId } = args;

    const deleteAll = async (table: Parameters<typeof ctx.db.query>[0], indexName: string) => {
      const rows = await (ctx.db.query(table) as any).withIndex(indexName, (q: any) =>
        q.eq("organisationId", organisationId)
      ).collect();
      await Promise.all(rows.map((r: { _id: Parameters<typeof ctx.db.delete>[0] }) => ctx.db.delete(r._id)));
    };

    await deleteAll("users", "by_org");
    await deleteAll("cases", "by_org");
    await deleteAll("tasks", "by_org");
    await deleteAll("documents", "by_org");
    await deleteAll("clients", "by_org");
    await deleteAll("comments", "by_org");
    await deleteAll("invoices", "by_org");
    await deleteAll("invitations", "by_org");
    await deleteAll("appointments", "by_org");
    await deleteAll("notifications", "by_org");
    await deleteAll("automationRules", "by_org");
    await deleteAll("organisationSettings", "by_org");

    await ctx.db.delete(organisationId);
  },
});

/** Clears the deletedAt timestamp, restoring the organisation. Admin only. */
export const reactivateOrg = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    const org = await ctx.db.get(ctx.user.organisationId);
    if (!org) throw new ConvexError({ code: "NOT_FOUND", message: "Organisation not found." });
    await ctx.db.patch(ctx.user.organisationId, { deletedAt: undefined });
  },
});
