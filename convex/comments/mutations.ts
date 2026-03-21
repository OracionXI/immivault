import { authenticatedMutation } from "../lib/auth";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getVisibleCaseIds } from "../lib/visibility";
import type { Id } from "../_generated/dataModel";

export const create = authenticatedMutation({
  args: {
    entityType: v.union(v.literal("case"), v.literal("task")),
    entityId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { role, _id: userId, organisationId } = ctx.user;

    // Verify the entity exists in the user's org and the user has visibility
    if (args.entityType === "case") {
      const c = await ctx.db.get(args.entityId as Id<"cases">);
      if (!c || c.organisationId !== organisationId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
      }
      if (role !== "admin") {
        const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
        if (!visibleCaseIds.has(args.entityId)) {
          throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
        }
      }
    } else {
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
        } else if (role === "staff" && task.assignedTo !== userId) {
          throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
        }
      }
    }

    const id = await ctx.db.insert("comments", {
      ...args,
      organisationId,
      authorId: ctx.user._id,
    });
    // Notify entity assignee + anyone @mentioned in the comment
    await ctx.scheduler.runAfter(0, internal.notifications.actions.onComment, {
      commentId: id,
    });
    return id;
  },
});

/** Only the comment author can edit their own comment. */
export const update = authenticatedMutation({
  args: { id: v.id("comments"), body: v.string() },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment || comment.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Comment not found." });
    }
    if (comment.authorId !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can only edit your own comments." });
    }
    await ctx.db.patch(args.id, { body: args.body });
  },
});

/** Admin can delete any comment; others can only delete their own. */
export const remove = authenticatedMutation({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment || comment.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Comment not found." });
    }
    const isAdmin = ctx.user.role === "admin";
    if (!isAdmin && comment.authorId !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can only delete your own comments." });
    }
    await ctx.db.delete(args.id);
  },
});
