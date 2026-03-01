import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const create = authenticatedMutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    nationality: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    address: v.optional(v.string()),
    status: v.union(
      v.literal("Active"),
      v.literal("Pending"),
      v.literal("Inactive"),
      v.literal("Archived")
    ),
    assignedTo: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("clients", {
      ...args,
      organisationId: ctx.user.organisationId,
    });
  },
});

export const update = authenticatedMutation({
  args: {
    id: v.id("clients"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    nationality: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    address: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("Active"),
        v.literal("Pending"),
        v.literal("Inactive"),
        v.literal("Archived")
      )
    ),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const client = await ctx.db.get(id);
    if (!client || client.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    await ctx.db.patch(id, fields);
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.id);
    if (!client || client.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    await ctx.db.delete(args.id);
  },
});
