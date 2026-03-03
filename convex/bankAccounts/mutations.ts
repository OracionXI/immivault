import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAdmin } from "../lib/rbac";

export const create = authenticatedMutation({
  args: {
    bankName: v.string(),
    accountName: v.string(),
    accountNumber: v.string(),
    routingNumber: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const existing = await ctx.db
      .query("bankAccounts")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .collect();

    // First account is automatically the default
    const isDefault = existing.length === 0;

    return await ctx.db.insert("bankAccounts", {
      ...args,
      isDefault,
      organisationId: ctx.user.organisationId,
    });
  },
});

export const setDefault = authenticatedMutation({
  args: { id: v.id("bankAccounts") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const account = await ctx.db.get(args.id);
    if (!account || account.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Account not found." });
    }
    // Clear all existing defaults, then set the new one
    const all = await ctx.db
      .query("bankAccounts")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .collect();
    for (const a of all) {
      await ctx.db.patch(a._id, { isDefault: a._id === args.id });
    }
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("bankAccounts") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const account = await ctx.db.get(args.id);
    if (!account || account.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Account not found." });
    }
    await ctx.db.delete(args.id);

    // If we removed the default, promote the first remaining account
    if (account.isDefault) {
      const remaining = await ctx.db
        .query("bankAccounts")
        .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
        .first();
      if (remaining) await ctx.db.patch(remaining._id, { isDefault: true });
    }
  },
});
