/**
 * DEV-ONLY: Bootstrap the current Clerk user into Convex.
 *
 * Run this once from the Convex dashboard → Functions → seed:initCurrentUser
 * when you haven't set up the Clerk webhook yet.
 *
 * It creates:
 *   1. An organisation record (skips if already exists)
 *   2. A users record for the authenticated caller (skips if already exists)
 *   3. Default organisationSettings
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const initCurrentUser = mutation({
  args: {
    orgName: v.optional(v.string()),
    fullName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated — log in first.");

    const orgName = args.orgName ?? "My Immigration Firm";
    const fullName = args.fullName ?? identity.name ?? identity.email ?? "Admin";
    const email = (identity.email as string | undefined) ?? "";
    const slug = orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // 1. Find or create the organisation
    let orgId = (
      await ctx.db
        .query("organisations")
        .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", "dev-seed-org"))
        .unique()
    )?._id;

    if (!orgId) {
      orgId = await ctx.db.insert("organisations", {
        clerkOrgId: "dev-seed-org",
        name: orgName,
        slug,
        plan: "free",
      });

      // Seed default settings
      await ctx.db.insert("organisationSettings", {
        organisationId: orgId,
        defaultCurrency: "USD",
        taxRate: 0,
        bookingEnabled: false,
      });
    }

    // 2. Find or create the user
    let userId = (
      await ctx.db
        .query("users")
        .withIndex("by_token", (q) =>
          q.eq("tokenIdentifier", identity.tokenIdentifier)
        )
        .unique()
    )?._id;

    if (!userId) {
      userId = await ctx.db.insert("users", {
        clerkUserId: (identity.subject as string) ?? "dev-seed-user",
        tokenIdentifier: identity.tokenIdentifier,
        email,
        fullName,
        organisationId: orgId,
        role: "admin",
        status: "active",
      });
    }

    return { orgId, userId, message: "Seed complete — refresh the app." };
  },
});
