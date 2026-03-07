import { internalQuery } from "../_generated/server";
import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getVisibleCaseIds } from "../lib/visibility";

/**
 * Visible tasks scoped by role:
 *   admin        → all tasks in org
 *   case_manager → all tasks under clients linked to their assigned cases
 *   staff        → all tasks under clients linked to cases containing their assigned tasks
 */
export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const { role, _id: userId, organisationId } = ctx.user;

    if (role === "admin") {
      return (await ctx.db
        .query("tasks")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .order("desc")
        .collect()).filter((t) => !t.hidden);
    }

    const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
      .collect();
    return allTasks.filter((t) => !t.hidden && t.caseId && visibleCaseIds.has(t.caseId));
  },
});

/** Tasks for a specific case — respects role visibility. */
export const listByCase = authenticatedQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    return (await ctx.db
      .query("tasks")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect()).filter((t) => !t.hidden);
  },
});

/**
 * Internal: tasks due within a specific time window.
 * Used by the daily task reminder cron job.
 */
export const listDueTomorrow = internalQuery({
  args: { start: v.number(), end: v.number() },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "Completed"),
          q.gte(q.field("dueDate"), args.start),
          q.lte(q.field("dueDate"), args.end)
        )
      )
      .collect();

    return await Promise.all(
      tasks.map(async (task) => {
        const assignee = task.assignedTo ? await ctx.db.get(task.assignedTo) : null;
        return {
          ...task,
          assigneeEmail: assignee?.email ?? null,
          assigneeName: assignee?.fullName ?? "Team Member",
        };
      })
    );
  },
});

/** Internal: get a task by ID without auth checks. Used by notification actions. */
export const getById = internalQuery({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
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
