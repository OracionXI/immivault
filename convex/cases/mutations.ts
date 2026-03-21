import { authenticatedMutation } from "../lib/auth";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAdmin, requireAtLeastCaseManager } from "../lib/rbac";

const statusValidator = v.string();

const priorityValidator = v.union(
  v.literal("Low"),
  v.literal("Medium"),
  v.literal("High"),
  v.literal("Urgent")
);

/**
 * Unassigns all tasks on a case that belong to a specific case manager.
 * Called whenever a case manager is removed or replaced on a case.
 */
async function unassignCaseManagerTasks(
  ctx: { db: any },
  caseId: string,
  oldAssigneeId: string
) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_case", (q: any) => q.eq("caseId", caseId))
    .collect();
  const affected = tasks.filter((t: any) => t.assignedTo === oldAssigneeId);
  await Promise.all(affected.map((t: any) => ctx.db.patch(t._id, { assignedTo: undefined })));
}

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
    issue: v.optional(v.string()),
    status: statusValidator,
    priority: priorityValidator,
    assignedTo: v.optional(v.id("users")),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);

    const client = await ctx.db.get(args.clientId);
    if (!client || client.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }

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
    issue: v.optional(v.string()),
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
    if (fields.clientId) {
      const client = await ctx.db.get(fields.clientId);
      if (!client || client.organisationId !== ctx.user.organisationId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
      }
    }

    const patch: Record<string, unknown> = { ...fields, updatedAt: Date.now(), updatedBy: ctx.user._id };

    let newAssigneeId: string | null = null;

    // Only admins can change the assignment
    if (ctx.user.role !== "case_manager") {
      if (assignedTo === null) {
        // Unassign: cascade-clear tasks belonging to the old case manager
        if (c.assignedTo) {
          await unassignCaseManagerTasks(ctx, id, c.assignedTo);
        }
        patch.assignedTo = undefined;
      } else if (assignedTo !== undefined) {
        await requireCaseManagerTarget(ctx, assignedTo, ctx.user.organisationId);
        patch.assignedTo = assignedTo;
        if (assignedTo !== c.assignedTo) {
          newAssigneeId = assignedTo;
          // Reassign: old manager's tasks go unassigned, new manager starts fresh
          if (c.assignedTo) {
            await unassignCaseManagerTasks(ctx, id, c.assignedTo);
          }
        }
      }
    }

    await ctx.db.patch(id, patch as any);

    // Fire the generic "case updated" notification only when something other
    // than the assignee changed — if we also fire onCaseAssigned we skip this
    // to avoid a duplicate notification for the same action.
    const hasOtherChanges = Object.keys(fields).length > 0 || assignedTo === null;
    if (!newAssigneeId || hasOtherChanges) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onCaseUpdated, {
        caseId: id,
        updatedById: ctx.user._id,
      });
    }
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

    const patch: Record<string, unknown> = { status: args.status, updatedAt: Date.now(), updatedBy: ctx.user._id };
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

    await ctx.scheduler.runAfter(0, internal.notifications.actions.onCaseUpdated, {
      caseId: args.id,
      updatedById: ctx.user._id,
    });
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

/** Admin-only: delete a case (with full cascade). */
export const remove = authenticatedMutation({
  args: { id: v.id("cases") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const c = await ctx.db.get(args.id);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }

    const orgId = ctx.user.organisationId;
    const caseIdStr = args.id as string;

    // 1. Delete all tasks under this case (and their comments)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_case", (q) => q.eq("caseId", args.id))
      .collect();
    for (const task of tasks) {
      // Delete comments on each task
      const taskComments = await ctx.db
        .query("comments")
        .withIndex("by_entity", (q) => q.eq("entityType", "task").eq("entityId", task._id as string))
        .collect();
      await Promise.all(taskComments.map((cm) => ctx.db.delete(cm._id)));
      await ctx.db.delete(task._id);
    }

    // 2. Delete comments on the case itself
    const caseComments = await ctx.db
      .query("comments")
      .withIndex("by_entity", (q) => q.eq("entityType", "case").eq("entityId", caseIdStr))
      .collect();
    await Promise.all(caseComments.map((cm) => ctx.db.delete(cm._id)));

    // 3. Delete documents linked to this case (and their storage files)
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.id))
      .collect();
    for (const doc of docs) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(doc._id);
    }

    // 4. Unlink appointments
    const appts = await ctx.db
      .query("appointments")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .collect();
    await Promise.all(
      appts.filter((a) => a.caseId === args.id).map((a) => ctx.db.patch(a._id, { caseId: undefined }))
    );

    // 5. Unlink invoices, payments, and payment links
    const [invoices, payments, paymentLinks] = await Promise.all([
      ctx.db.query("invoices").withIndex("by_client", (q) => q.eq("clientId", c.clientId)).collect(),
      ctx.db.query("payments").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
      ctx.db.query("paymentLinks").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
    ]);
    await Promise.all([
      ...invoices.filter((i) => i.caseId === args.id).map((i) => ctx.db.patch(i._id, { caseId: undefined })),
      ...payments.filter((p) => p.caseId === args.id).map((p) => ctx.db.patch(p._id, { caseId: undefined })),
      ...paymentLinks.filter((l) => l.caseId === args.id).map((l) => ctx.db.patch(l._id, { caseId: undefined })),
    ]);

    // 6. Delete the case
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

    // Cascade: unassign old manager's tasks when the assignee changes or is removed
    if (c.assignedTo && c.assignedTo !== args.assignedTo) {
      await unassignCaseManagerTasks(ctx, args.id, c.assignedTo);
    }

    await ctx.db.patch(args.id, { assignedTo: args.assignedTo, updatedAt: Date.now(), updatedBy: ctx.user._id });

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
