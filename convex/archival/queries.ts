import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/** Fetches all data needed to build the archival PDF report for a case. */
export const getCaseForArchival = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.caseId);
    if (!c) return null;

    const client = await ctx.db.get(c.clientId);
    const assignedManager = c.assignedTo ? await ctx.db.get(c.assignedTo) : null;
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();

    return { case: c, client, assignedManager, tasks };
  },
});
