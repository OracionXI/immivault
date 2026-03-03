import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAdmin } from "../lib/rbac";

const statusValidator = v.union(v.literal("active"), v.literal("inactive"));

export const create = authenticatedMutation({
  args: {
    name: v.string(),
    trigger: v.string(),
    condition: v.string(),
    action: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    return await ctx.db.insert("automationRules", {
      ...args,
      organisationId: ctx.user.organisationId,
      status: "active",
    });
  },
});

export const updateStatus = authenticatedMutation({
  args: { id: v.id("automationRules"), status: statusValidator },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const rule = await ctx.db.get(args.id);
    if (!rule || rule.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Rule not found." });
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("automationRules") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const rule = await ctx.db.get(args.id);
    if (!rule || rule.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Rule not found." });
    }
    await ctx.db.delete(args.id);
  },
});
