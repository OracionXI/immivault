import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/** Internal: get a comment by ID. Used by onComment notification action. */
export const getById = internalQuery({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Comments for a case or task. entityId is the string form of a Convex Id. */
export const listByEntity = authenticatedQuery({
  args: {
    entityType: v.union(v.literal("case"), v.literal("task")),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .order("asc")
      .collect();
  },
});
