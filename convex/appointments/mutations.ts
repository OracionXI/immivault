import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAtLeastCaseManager } from "../lib/rbac";

const statusValidator = v.union(
  v.literal("Scheduled"),
  v.literal("Confirmed"),
  v.literal("Completed"),
  v.literal("Cancelled")
);

const typeValidator = v.union(
  v.literal("Consultation"),
  v.literal("Document Review"),
  v.literal("Interview Prep"),
  v.literal("Follow-up")
);

/** Admin or Case Manager: create an appointment. */
export const create = authenticatedMutation({
  args: {
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    assignedTo: v.optional(v.id("users")),
    title: v.string(),
    type: typeValidator,
    status: statusValidator,
    startAt: v.number(),
    endAt: v.number(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    return await ctx.db.insert("appointments", {
      ...args,
      organisationId: ctx.user.organisationId,
    });
  },
});

/** Admin or Case Manager: update an appointment. */
export const update = authenticatedMutation({
  args: {
    id: v.id("appointments"),
    clientId: v.optional(v.id("clients")),
    caseId: v.optional(v.id("cases")),
    assignedTo: v.optional(v.id("users")),
    title: v.optional(v.string()),
    type: v.optional(typeValidator),
    status: v.optional(statusValidator),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    const { id, ...fields } = args;
    const appt = await ctx.db.get(id);
    if (!appt || appt.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment not found." });
    }
    await ctx.db.patch(id, fields);
  },
});

export const updateStatus = authenticatedMutation({
  args: { id: v.id("appointments"), status: statusValidator },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    const appt = await ctx.db.get(args.id);
    if (!appt || appt.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment not found." });
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

/** Admin or Case Manager: delete an appointment. */
export const remove = authenticatedMutation({
  args: { id: v.id("appointments") },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    const appt = await ctx.db.get(args.id);
    if (!appt || appt.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment not found." });
    }
    await ctx.db.delete(args.id);
  },
});
