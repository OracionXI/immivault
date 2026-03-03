import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getVisibleCaseIds } from "../lib/visibility";

/**
 * Visible cases scoped by role:
 *   admin        → all cases in org
 *   case_manager → cases directly assigned to them
 *   staff        → cases that contain tasks assigned to them
 */
export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const { role, _id: userId, organisationId } = ctx.user;

    if (role === "admin") {
      return await ctx.db
        .query("cases")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .order("desc")
        .collect();
    }

    const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
    const cases = await Promise.all([...visibleCaseIds].map((id) => ctx.db.get(id)));
    return cases.filter(
      (c): c is NonNullable<typeof c> => c !== null && c.organisationId === organisationId
    );
  },
});

/** All visible cases — for dropdown pickers. */
export const listAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const { role, _id: userId, organisationId } = ctx.user;

    if (role === "admin") {
      return await ctx.db
        .query("cases")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .collect();
    }

    const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
    const cases = await Promise.all([...visibleCaseIds].map((id) => ctx.db.get(id)));
    return cases.filter(
      (c): c is NonNullable<typeof c> => c !== null && c.organisationId === organisationId
    );
  },
});

/** Single case by ID. */
export const get = authenticatedQuery({
  args: { id: v.id("cases") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.id);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }
    return c;
  },
});

/** Cases for a specific client. */
export const listByClient = authenticatedQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("cases")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    // Verify all returned cases belong to the caller's org
    return rows.filter((c) => c.organisationId === ctx.user.organisationId);
  },
});
