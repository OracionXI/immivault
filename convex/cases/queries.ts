import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/** All cases in the org — for dropdown pickers. */
export const listAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("cases")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .collect();
  },
});

/** Full list for the kanban board. */
export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("cases")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .order("desc")
      .collect();
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
    return await ctx.db
      .query("cases")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
  },
});
