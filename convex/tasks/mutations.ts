import { internalMutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAtLeastCaseManager } from "../lib/rbac";

const statusValidator = v.union(
  v.literal("To Do"),
  v.literal("In Progress"),
  v.literal("In Review"),
  v.literal("On Hold"),
  v.literal("Completed"),
  v.literal("Rejected")
);

const priorityValidator = v.union(
  v.literal("Low"),
  v.literal("Medium"),
  v.literal("High"),
  v.literal("Urgent")
);

/** Builds a sequential human-readable task ID like TASK-0001. */
async function buildTaskId(ctx: { db: any }, organisationId: string): Promise<string> {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_org", (q: any) => q.eq("organisationId", organisationId))
    .collect();

  let max = 0;
  for (const t of tasks) {
    if (t.taskId) {
      const parts = t.taskId.split("-");
      const num = parseInt(parts[1] ?? "0", 10);
      if (num > max) max = num;
    }
  }
  return `TASK-${String(max + 1).padStart(4, "0")}`;
}

/** Tasks can only be assigned to case managers or staff — never admins. */
async function requireNonAdminTarget(
  ctx: { db: any },
  userId: string,
  organisationId: string
) {
  const target = await ctx.db.get(userId);
  if (
    !target ||
    target.organisationId !== organisationId ||
    target.role === "admin"
  ) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Tasks can only be assigned to case managers or staff.",
    });
  }
}

/** Admin or Case Manager: create a task. Sets sequential taskId. */
export const create = authenticatedMutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
    assignedTo: v.optional(v.id("users")),
    status: statusValidator,
    priority: priorityValidator,
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);

    // Case managers can only create tasks under their own cases
    if (ctx.user.role === "case_manager" && args.caseId) {
      const c = await ctx.db.get(args.caseId);
      if (!c || c.assignedTo !== ctx.user._id) {
        throw new ConvexError({ code: "FORBIDDEN", message: "You can only create tasks in your own cases." });
      }
    }

    if (args.assignedTo) {
      await requireNonAdminTarget(ctx, args.assignedTo, ctx.user.organisationId);
    }

    const taskId = await buildTaskId(ctx, ctx.user.organisationId);

    const id = await ctx.db.insert("tasks", {
      ...args,
      taskId,
      organisationId: ctx.user.organisationId,
    });

    // Notify new assignee (skip if creator assigned to themselves)
    if (args.assignedTo) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onTaskAssigned, {
        taskId: id,
        newAssigneeId: args.assignedTo,
        assignerId: ctx.user._id,
      });
    }

    return id;
  },
});

/** Admin or Case Manager: update task details. */
export const update = authenticatedMutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
    // null = explicitly clear the assignee; undefined = leave unchanged
    assignedTo: v.optional(v.union(v.id("users"), v.null())),
    status: v.optional(statusValidator),
    priority: v.optional(priorityValidator),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    const { id, assignedTo, ...fields } = args;
    const task = await ctx.db.get(id);
    if (!task || task.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
    }

    // Case managers can only update tasks in their assigned cases
    if (ctx.user.role === "case_manager" && task.caseId) {
      const c = await ctx.db.get(task.caseId);
      if (!c || c.assignedTo !== ctx.user._id) {
        throw new ConvexError({ code: "FORBIDDEN", message: "You can only update tasks in your own cases." });
      }
    }

    const patch: Record<string, unknown> = { ...fields };
    let newAssigneeId: string | null = null;

    if (assignedTo === null) {
      patch.assignedTo = undefined; // clear the assignee
    } else if (assignedTo !== undefined) {
      await requireNonAdminTarget(ctx, assignedTo, ctx.user.organisationId);
      patch.assignedTo = assignedTo;
      if (assignedTo !== task.assignedTo) {
        newAssigneeId = assignedTo;
      }
    }

    // Track completedAt
    if (fields.status === "Completed" && task.status !== "Completed") {
      patch.completedAt = Date.now();
    } else if (fields.status && fields.status !== "Completed" && task.status === "Completed") {
      patch.completedAt = undefined;
    }

    await ctx.db.patch(id, patch as any);

    // Notify new assignee
    if (newAssigneeId) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onTaskAssigned, {
        taskId: id,
        newAssigneeId: newAssigneeId as any,
        assignerId: ctx.user._id,
      });
    }
    // Notify assignee of status change (by someone else)
    if (fields.status && fields.status !== task.status) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onTaskStatusChanged, {
        taskId: id,
        changedById: ctx.user._id,
        newStatus: fields.status,
      });
    }
  },
});

/**
 * Targeted status update — Kanban drag-and-drop.
 * Staff can update their own tasks. Case managers + admins can update any visible task.
 */
export const updateStatus = authenticatedMutation({
  args: { id: v.id("tasks"), status: statusValidator },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task || task.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
    }

    // Staff can only update tasks assigned to them
    if (ctx.user.role === "staff" && task.assignedTo !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can only update tasks assigned to you." });
    }

    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "Completed" && task.status !== "Completed") {
      patch.completedAt = Date.now();
    } else if (args.status !== "Completed" && task.status === "Completed") {
      patch.completedAt = undefined;
    }

    await ctx.db.patch(args.id, patch as any);

    // Notify assignee of status change (by someone else)
    if (args.status !== task.status) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onTaskStatusChanged, {
        taskId: args.id,
        changedById: ctx.user._id,
        newStatus: args.status,
      });
    }
  },
});

/**
 * Internal cron target: escalate priority to "Urgent" for all tasks
 * whose due date has passed and are not yet completed.
 * Also fires overdue notifications for each affected task.
 */
export const markOverdueUrgent = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const overdue = await ctx.db
      .query("tasks")
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "Completed"),
          q.neq(q.field("priority"), "Urgent"),
          q.lt(q.field("dueDate"), now)
        )
      )
      .collect();

    await Promise.all(
      overdue.map(async (task) => {
        await ctx.db.patch(task._id, { priority: "Urgent" });
        // Fire overdue notification (only fires once since task becomes Urgent and won't match again)
        if (task.assignedTo) {
          await ctx.scheduler.runAfter(0, internal.notifications.actions.onTaskOverdue, {
            taskId: task._id,
          });
        }
      })
    );
  },
});

/** Admin or Case Manager: delete a task. */
export const remove = authenticatedMutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    const task = await ctx.db.get(args.id);
    if (!task || task.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
    }

    // Case managers can only delete tasks in their cases
    if (ctx.user.role === "case_manager" && task.caseId) {
      const c = await ctx.db.get(task.caseId);
      if (!c || c.assignedTo !== ctx.user._id) {
        throw new ConvexError({ code: "FORBIDDEN", message: "You can only delete tasks in your own cases." });
      }
    }

    await ctx.db.delete(args.id);
  },
});
