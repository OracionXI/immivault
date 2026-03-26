import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import { requireAdminOrAccountant } from "../lib/rbac";

export const listAll = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    requireAdminOrAccountant(ctx);
    return await ctx.db
      .query("bankTransactions")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .order("desc")
      .collect();
  },
});

export const listByAccount = authenticatedQuery({
  args: { bankAccountId: v.id("bankAccounts") },
  handler: async (ctx, args) => {
    requireAdminOrAccountant(ctx);
    // Verify the account belongs to this org
    const account = await ctx.db.get(args.bankAccountId);
    if (!account || account.organisationId !== ctx.user.organisationId) return [];

    return await ctx.db
      .query("bankTransactions")
      .withIndex("by_account", (q) => q.eq("bankAccountId", args.bankAccountId))
      .order("desc")
      .collect();
  },
});
