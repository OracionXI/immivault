import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
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

    if (role === "admin" || role === "accountant") {
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

    if (role === "admin" || role === "accountant") {
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

/** Single client by ID — enforces org isolation + role-based visibility. */
export const get = authenticatedQuery({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const { role, _id: userId, organisationId } = ctx.user;
    const client = await ctx.db.get(args.id);
    if (!client || client.organisationId !== organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }

    if (role !== "admin" && role !== "accountant") {
      const visibleClientIds = await getVisibleClientIds(ctx.db, role, userId, organisationId);
      if (!visibleClientIds.has(args.id)) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
      }
    }

    return client;
  },
});

/** Internal query — used by billing actions to fetch client contractAmount without user auth. */
export const getForAction = internalQuery({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
