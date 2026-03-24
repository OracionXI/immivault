import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getVisibleCaseIds } from "../lib/visibility";
import type { Id } from "../_generated/dataModel";

/** Internal: get a comment by ID. Used by onComment notification action. */
export const getById = internalQuery({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Comments for a case or task. entityId is the string form of a Convex Id.
 *  Enforces: org isolation + role-based entity visibility before returning comments.
 */
export const listByEntity = authenticatedQuery({
  args: {
    entityType: v.union(v.literal("case"), v.literal("task")),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const { role, _id: userId, organisationId } = ctx.user;

    if (args.entityType === "case") {
      const c = await ctx.db.get(args.entityId as Id<"cases">);
      if (!c || c.organisationId !== organisationId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
      }
      if (role !== "admin") {
        const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
        if (!visibleCaseIds.has(c._id)) {
          throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
        }
      }
    } else {
      // task
      const task = await ctx.db.get(args.entityId as Id<"tasks">);
      if (!task || task.organisationId !== organisationId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
      }
      if (role !== "admin") {
        if (task.caseId) {
          const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
          if (!visibleCaseIds.has(task.caseId)) {
            throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
          }
        } else {
          // Standalone task (no case): staff can only see their own assigned tasks
          if (role === "staff" && task.assignedTo !== userId) {
            throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
          }
        }
      }
    }

    return await ctx.db
      .query("comments")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .order("asc")
      .collect();
  },
});
