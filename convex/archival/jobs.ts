import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Daily cron target.
 * Finds every Completed case whose completedAt is older than 40 days
 * and schedules a PDF archival action for each.
 */
export const archiveCompletedCases = internalMutation({
  args: {},
  handler: async (ctx) => {
    const FORTY_DAYS_MS = 40 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - FORTY_DAYS_MS;

    const orgs = await ctx.db.query("organisations").collect();

    for (const org of orgs) {
      const completedCases = await ctx.db
        .query("cases")
        .withIndex("by_org_and_status", (q) =>
          q.eq("organisationId", org._id).eq("status", "Completed")
        )
        .collect();

      for (const c of completedCases) {
        if (c.completedAt !== undefined && c.completedAt < cutoff) {
          await ctx.scheduler.runAfter(
            0,
            internal.archival.actions.generateArchivalReport,
            { caseId: c._id }
          );
        }
      }
    }
  },
});
