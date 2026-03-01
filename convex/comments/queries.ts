import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";

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
