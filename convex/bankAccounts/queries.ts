import { authenticatedQuery } from "../lib/auth";

export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("bankAccounts")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .collect();
  },
});
