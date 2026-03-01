import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

const statusValidator = v.union(
  v.literal("Active"),
  v.literal("Pending"),
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

/** Generates a sequential case number like IMV-20240315-0042. */
function buildCaseNumber(): string {
  const date = new Date();
  const ymd =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `IMV-${ymd}-${rand}`;
}

export const create = authenticatedMutation({
  args: {
    title: v.string(),
    clientId: v.id("clients"),
    visaType: v.string(),
    status: statusValidator,
    priority: priorityValidator,
    assignedTo: v.id("users"),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("cases", {
      ...args,
      caseNumber: buildCaseNumber(),
      organisationId: ctx.user.organisationId,
    });
  },
});

export const update = authenticatedMutation({
  args: {
    id: v.id("cases"),
    title: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    visaType: v.optional(v.string()),
    status: v.optional(statusValidator),
    priority: v.optional(priorityValidator),
    assignedTo: v.optional(v.id("users")),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const c = await ctx.db.get(id);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }
    await ctx.db.patch(id, fields);
  },
});

/** Targeted status update used by Kanban drag-and-drop. */
export const updateStatus = authenticatedMutation({
  args: { id: v.id("cases"), status: statusValidator },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.id);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("cases") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.id);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }
    await ctx.db.delete(args.id);
  },
});
