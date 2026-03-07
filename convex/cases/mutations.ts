import { authenticatedMutation } from "../lib/auth";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAdmin, requireAtLeastCaseManager } from "../lib/rbac";

const statusValidator = v.union(
  v.literal("Active"),
  v.literal("Pending"),
  v.literal("On Hold"),
  v.literal("Completed"),
  v.literal("Rejected"),
  v.literal("Archived")
);

const priorityValidator = v.union(
  v.literal("Low"),
  v.literal("Medium"),
  v.literal("High"),
  v.literal("Urgent")
);

/** Cases can only be assigned to case managers — not admins or staff. */
async function requireCaseManagerTarget(
  ctx: { db: any },
  userId: string,
  organisationId: string
) {
  const target = await ctx.db.get(userId);
  if (
    !target ||
    target.organisationId !== organisationId ||
    target.role !== "case_manager"
  ) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Cases can only be assigned to case managers.",
    });
  }
}

/** Admin-only: create a case manually (auto-case creation is done via clients.create). */
export const create = authenticatedMutation({
  args: {
    title: v.string(),
    clientId: v.id("clients"),
    visaType: v.string(),
    status: statusValidator,
    priority: priorityValidator,
    assignedTo: v.optional(v.id("users")),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);

    if (args.assignedTo) {
      await requireCaseManagerTarget(ctx, args.assignedTo, ctx.user.organisationId);
    }

    const date = new Date();
    const ymd =
      date.getFullYear().toString() +
      String(date.getMonth() + 1).padStart(2, "0") +
      String(date.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000 + 1000);
    const caseNumber = `IMV-${ymd}-${rand}`;

    const id = await ctx.db.insert("cases", {
      ...args,
      caseNumber,
      organisationId: ctx.user.organisationId,
    });

    // Notify all admins (except creator) that a new case was created
    await ctx.scheduler.runAfter(0, internal.notifications.actions.onCaseCreated, {
      caseId: id,
      creatorId: ctx.user._id,
    });

    // Also notify the assignee if one was set at creation time
    if (args.assignedTo) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onCaseAssigned, {
        caseId: id,
        newAssigneeId: args.assignedTo,
        assignerId: ctx.user._id,
      });
    }

    return id;
  },
});

/**
 * Update case fields.
 *   admin        → any case, can reassign or unassign (pass null to clear)
 *   case_manager → only their assigned cases, assignedTo is silently ignored
 */
export const update = authenticatedMutation({
  args: {
    id: v.id("cases"),
    title: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    visaType: v.optional(v.string()),
    status: v.optional(statusValidator),
    priority: v.optional(priorityValidator),
    // null = explicitly clear the assignee; undefined = leave unchanged
    assignedTo: v.optional(v.union(v.id("users"), v.null())),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    const { id, assignedTo, ...fields } = args;
    const c = await ctx.db.get(id);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }
    // Case managers can only update their own assigned cases
    if (ctx.user.role === "case_manager" && c.assignedTo !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can only update cases assigned to you." });
    }

    const patch: Record<string, unknown> = { ...fields };

    let newAssigneeId: string | null = null;

    // Only admins can change the assignment
    if (ctx.user.role !== "case_manager") {
      if (assignedTo === null) {
        patch.assignedTo = undefined; // clear the assignee
      } else if (assignedTo !== undefined) {
        await requireCaseManagerTarget(ctx, assignedTo, ctx.user.organisationId);
        patch.assignedTo = assignedTo;
        if (assignedTo !== c.assignedTo) {
          newAssigneeId = assignedTo;
        }
      }
    }

    await ctx.db.patch(id, patch as any);

    // Fire notifications after the patch
    if (newAssigneeId) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onCaseAssigned, {
        caseId: id,
        newAssigneeId: newAssigneeId as any,
        assignerId: ctx.user._id,
      });
    }
    if (fields.status && fields.status !== c.status) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onCaseStatusChanged, {
        caseId: id,
        changedById: ctx.user._id,
        newStatus: fields.status,
      });
    }
  },
});

/**
 * Targeted status update — used by Kanban drag-and-drop.
 * Sets completedAt when moving to Completed; clears it when moving away.
 */
export const updateStatus = authenticatedMutation({
  args: { id: v.id("cases"), status: statusValidator },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    const c = await ctx.db.get(args.id);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }
    if (ctx.user.role === "case_manager" && c.assignedTo !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can only update cases assigned to you." });
    }

    const patch: Record<string, unknown> = { status: args.status };
    if (args.status === "Completed") {
      patch.completedAt = Date.now();
      // Expire all documents linked to this case
      const caseDocs = await ctx.db
        .query("documents")
        .withIndex("by_case", (q) => q.eq("caseId", args.id))
        .collect();
      for (const doc of caseDocs) {
        await ctx.db.patch(doc._id, { status: "Expired" });
      }
    } else if (c.status === "Completed") {
      // Moving away from Completed — clear the timestamp
      patch.completedAt = undefined;
    }

    await ctx.db.patch(args.id, patch as any);

    // Notify assignee of status change
    if (args.status !== c.status) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onCaseStatusChanged, {
        caseId: args.id,
        changedById: ctx.user._id,
        newStatus: args.status,
      });
    }
  },
});

/** Admin-only: delete a case. */
export const remove = authenticatedMutation({
  args: { id: v.id("cases") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const c = await ctx.db.get(args.id);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }
    await ctx.db.delete(args.id);
  },
});

/** Admin-only: assign a case to a case manager. */
export const assign = authenticatedMutation({
  args: { id: v.id("cases"), assignedTo: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const c = await ctx.db.get(args.id);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }
    if (args.assignedTo) {
      await requireCaseManagerTarget(ctx, args.assignedTo, ctx.user.organisationId);
    }
    await ctx.db.patch(args.id, { assignedTo: args.assignedTo });

    // Notify new assignee (only when assigning, not when clearing)
    if (args.assignedTo && args.assignedTo !== c.assignedTo) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onCaseAssigned, {
        caseId: args.id,
        newAssigneeId: args.assignedTo,
        assignerId: ctx.user._id,
      });
    }
  },
});

/** Internal: mark a case as having had its deadline notification sent. */
export const setDeadlineNotified = internalMutation({
  args: { id: v.id("cases") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { deadlineNotifiedAt: Date.now() });
  },
});
