import { authenticatedMutation } from "../lib/auth";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "../lib/rbac";

export const create = authenticatedMutation({
  args: {
    bankAccountId: v.id("bankAccounts"),
    type: v.union(v.literal("money_in"), v.literal("money_out")),
    amount: v.number(), // in cents
    currency: v.string(),
    description: v.string(),
    reference: v.optional(v.string()),
    date: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const account = await ctx.db.get(args.bankAccountId);
    if (!account || account.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Bank account not found." });
    }
    return await ctx.db.insert("bankTransactions", {
      ...args,
      organisationId: ctx.user.organisationId,
    });
  },
});

export const remove = authenticatedMutation({
  args: { id: v.id("bankTransactions") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const txn = await ctx.db.get(args.id);
    if (!txn || txn.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Transaction not found." });
    }
    await ctx.db.delete(args.id);
  },
});
