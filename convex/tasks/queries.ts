import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/** All tasks in the org — for the Kanban board. */
export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .order("desc")
      .collect();
  },
});

/** Tasks for a specific case. */
export const listByCase = authenticatedQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
  },
});

/** Single task by ID. */
export const get = authenticatedQuery({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task || task.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
    }
    return task;
  },
});
