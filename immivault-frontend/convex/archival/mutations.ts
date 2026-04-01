import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Finalises archival: deletes tasks + comments for the case,
 * stores the PDF report storageId, and flips the case status to "Archived".
 */
export const finalizeArchival = internalMutation({
  args: {
    caseId: v.id("cases"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Delete all tasks for this case
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    // Delete all comments for this case
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "case").eq("entityId", args.caseId)
      )
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Archive the case with the PDF report reference
    await ctx.db.patch(args.caseId, {
      status: "Archived",
      archivedReportStorageId: args.storageId,
    });
  },
});
