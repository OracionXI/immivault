import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getVisibleClientIds } from "../lib/visibility";

/**
 * Visible clients scoped by role:
 *   admin        → all clients in org
 *   case_manager → clients linked to cases assigned to them
 *   staff        → clients linked to cases that contain their assigned tasks
 */
export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const { role, _id: userId, organisationId } = ctx.user;

    if (role === "admin") {
      return await ctx.db
        .query("clients")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .order("desc")
        .collect();
    }

    const visibleClientIds = await getVisibleClientIds(ctx.db, role, userId, organisationId);
    const all = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
      .collect();
    return all.filter((c) => visibleClientIds.has(c._id));
  },
});

/** Same as list but unordered — for dropdown pickers. */
export const listAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const { role, _id: userId, organisationId } = ctx.user;

    if (role === "admin") {
      return await ctx.db
        .query("clients")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .collect();
    }

    const visibleClientIds = await getVisibleClientIds(ctx.db, role, userId, organisationId);
    const all = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
      .collect();
    return all.filter((c) => visibleClientIds.has(c._id));
  },
});

/** Single client by ID — verifies it belongs to the caller's org. */
export const get = authenticatedQuery({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.id);
    if (!client || client.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    return client;
  },
});
