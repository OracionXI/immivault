/**
 * DEV-ONLY: Bootstrap the current Clerk user into Convex.
 *
 * Run initCurrentUser once from the Convex dashboard → Functions → seed:initCurrentUser
 * when you haven't set up the Clerk webhook yet.
 *
 * Run clearAllData to wipe all records before a fresh start.
 */
import { mutation } from "./_generated/server";
import { DEFAULT_CUSTOM_ROLES } from "./organisations/mutations";

export const initCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated — log in first.");

    const fullName = identity.name ?? (identity.email as string | undefined) ?? "Admin";
    const email = (identity.email as string | undefined) ?? "";
    const orgName = "My Immigration Firm";
    const slug = orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // 1. Find or create the organisation
    let orgId = (
      await ctx.db.query("organisations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique()
    )?._id;

    if (!orgId) {
      orgId = await ctx.db.insert("organisations", {
        name: orgName,
        slug,
        plan: "free",
      });

      await ctx.db.insert("organisationSettings", {
        organisationId: orgId,
        defaultCurrency: "USD",
        taxRate: 0,
        customRoles: DEFAULT_CUSTOM_ROLES,
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

/**
 * DEV-ONLY: Repairs a missing organisation.
 *
 * Run this when you accidentally deleted the organisation record from the
 * Convex dashboard. It recreates the org and re-links all orphaned users,
 * clients, cases, tasks, documents, appointments, and invoices to it.
 *
 * Run from: Convex dashboard → Functions → seed:repairOrg
 */
export const repairOrg = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated — log in first.");
    const caller = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!caller || caller.role !== "admin") throw new Error("Admin privileges required.");

    const orgName = "My Immigration Firm";
    const slug = orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Re-create the organisation
    const orgId = await ctx.db.insert("organisations", {
      name: orgName,
      slug,
      plan: "free",
    });

    await ctx.db.insert("organisationSettings", {
      organisationId: orgId,
      defaultCurrency: "USD",
      taxRate: 0,
      customRoles: DEFAULT_CUSTOM_ROLES,
    });

    // Re-link all orphaned rows in every org-scoped table
    const tables = [
      "users",
      "clients",
      "cases",
      "tasks",
      "documents",
      "appointments",
      "invoices",
      "invoiceItems",
      "payments",
      "paymentLinks",
      "comments",
      "bankAccounts",
      "invitations",
    ] as const;

    let patched = 0;
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        if ("organisationId" in row) {
          await ctx.db.patch(row._id, { organisationId: orgId } as never);
          patched++;
        }
      }
    }

    return {
      orgId,
      patched,
      message: `Org recreated. ${patched} rows re-linked. Refresh the app.`,
    };
  },
});

/**
 * DEV-ONLY: Wipes all records from every table.
 * Run from the Convex dashboard before a fresh seed.
 */
export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated — log in first.");
    const caller = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!caller || caller.role !== "admin") throw new Error("Admin privileges required.");

    const tables = [
      "comments",
      "invoiceItems",
      "paymentLinks",
      "payments",
      "invoices",
      "documents",
      "tasks",
      "appointments",
      "cases",
      "clients",
      "rateLimits",
      "invitations",
      "bankAccounts",
      "organisationSettings",
      "users",
      "organisations",
    ] as const;

    let total = 0;
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        total++;
      }
    }

    return { message: `Cleared ${total} records across ${tables.length} tables.` };
  },
});
