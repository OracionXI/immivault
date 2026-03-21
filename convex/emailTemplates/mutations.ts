import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAdmin } from "../lib/rbac";

function validateTemplateFields(args: { name?: string; subject?: string; body?: string }) {
  if (args.name !== undefined && (args.name.trim().length === 0 || args.name.length > 100)) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Template name must be between 1 and 100 characters." });
  }
  if (args.subject !== undefined && (args.subject.trim().length === 0 || args.subject.length > 255)) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Subject must be between 1 and 255 characters." });
  }
  if (args.body !== undefined && (args.body.trim().length === 0 || args.body.length > 20000)) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Body must be between 1 and 20,000 characters." });
  }
}

export const create = authenticatedMutation({
  args: {
    name: v.string(),
    subject: v.string(),
    body: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    validateTemplateFields(args);
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
    requireAdmin(ctx);
    const { id, ...fields } = args;
    validateTemplateFields(fields);
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
    requireAdmin(ctx);
    const tmpl = await ctx.db.get(args.id);
    if (!tmpl || tmpl.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Template not found." });
    }
    await ctx.db.delete(args.id);
  },
});
