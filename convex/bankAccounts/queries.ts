import { authenticatedQuery } from "../lib/auth";
import { requireAdminOrAccountant } from "../lib/rbac";

export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    requireAdminOrAccountant(ctx);
    return await ctx.db
      .query("bankAccounts")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .collect();
  },
});
