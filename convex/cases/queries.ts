import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { getVisibleCaseIds } from "../lib/visibility";

/**
 * Visible cases scoped by role:
 *   admin        → all cases in org (excluding Inactive-client cases)
 *   case_manager → cases directly assigned to them
 *   staff        → cases that contain tasks assigned to them
 */
export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const { role, _id: userId, organisationId } = ctx.user;

    const inactiveClients = await ctx.db
      .query("clients")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", organisationId).eq("status", "Inactive")
      )
      .collect();
    const inactiveClientIds = new Set(inactiveClients.map((c) => c._id));

    if (role === "admin") {
      const all = await ctx.db
        .query("cases")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .order("desc")
        .collect();
      return all.filter((c) => !inactiveClientIds.has(c.clientId));
    }

    const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
    const cases = await Promise.all([...visibleCaseIds].map((id) => ctx.db.get(id as Id<"cases">)));
    return cases.filter(
      (c): c is NonNullable<typeof c> =>
        c !== null && c.organisationId === organisationId && !inactiveClientIds.has(c.clientId)
    );
  },
});

/** All visible cases — for dropdown pickers. Excludes Inactive-client cases. */
export const listAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const { role, _id: userId, organisationId } = ctx.user;

    const inactiveClients = await ctx.db
      .query("clients")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", organisationId).eq("status", "Inactive")
      )
      .collect();
    const inactiveClientIds = new Set(inactiveClients.map((c) => c._id));

    if (role === "admin" || role === "accountant") {
      const all = await ctx.db
        .query("cases")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .collect();
      return all.filter((c) => !inactiveClientIds.has(c.clientId));
    }

    const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
    const cases = await Promise.all([...visibleCaseIds].map((id) => ctx.db.get(id as Id<"cases">)));
    return cases.filter(
      (c): c is NonNullable<typeof c> =>
        c !== null && c.organisationId === organisationId && !inactiveClientIds.has(c.clientId)
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

/** Internal: get a case by ID without auth checks. Used by notification actions. */
export const getById = internalQuery({
  args: { id: v.id("cases") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Internal: cases with deadline approaching within a time window. Used by deadline cron. */
export const listApproachingDeadline = internalQuery({
  args: { start: v.number(), end: v.number() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("cases")
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "Completed"),
          q.neq(q.field("status"), "Archived"),
          q.neq(q.field("status"), "Rejected"),
          q.gte(q.field("deadline"), args.start),
          q.lte(q.field("deadline"), args.end)
        )
      )
      .collect();
    // Return only cases with an assignee and no deadline notification already sent
    return all.filter((c) => c.assignedTo && !c.deadlineNotifiedAt);
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
