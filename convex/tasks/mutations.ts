import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

const statusValidator = v.union(
  v.literal("To Do"),
  v.literal("In Progress"),
  v.literal("In Review"),
  v.literal("Completed")
);

const priorityValidator = v.union(
  v.literal("Low"),
  v.literal("Medium"),
  v.literal("High"),
  v.literal("Urgent")
);

export const create = authenticatedMutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
    assignedTo: v.id("users"),
    status: statusValidator,
    priority: priorityValidator,
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      ...args,
      organisationId: ctx.user.organisationId,
    });
  },
});

export const update = authenticatedMutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
    assignedTo: v.optional(v.id("users")),
    status: v.optional(statusValidator),
    priority: v.optional(priorityValidator),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const task = await ctx.db.get(id);
    if (!task || task.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
    }
    await ctx.db.patch(id, fields);
  },
});

/** Targeted status update used by Kanban drag-and-drop. */
export const updateStatus = authenticatedMutation({
  args: { id: v.id("tasks"), status: statusValidator },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task || task.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task || task.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Task not found." });
    }
    await ctx.db.delete(args.id);
  },
});
