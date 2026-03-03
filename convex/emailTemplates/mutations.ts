import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const create = authenticatedMutation({
  args: {
    name: v.string(),
    subject: v.string(),
    body: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("emailTemplates", {
      ...args,
      organisationId: ctx.user.organisationId,
    });
  },
});

export const update = authenticatedMutation({
  args: {
    id: v.id("emailTemplates"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const tmpl = await ctx.db.get(id);
    if (!tmpl || tmpl.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Template not found." });
    }
    await ctx.db.patch(id, fields);
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, args) => {
    const tmpl = await ctx.db.get(args.id);
    if (!tmpl || tmpl.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Template not found." });
    }
    await ctx.db.delete(args.id);
  },
});
