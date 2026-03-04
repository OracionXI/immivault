import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireEnv } from "../env";

/**
 * Permanently purges organisations that have been soft-deleted for more than 30 days.
 * Called daily by the cron scheduler.
 *
 * For each expired org:
 *  1. Deletes every linked user from Clerk (they can no longer sign in)
 *  2. Calls permanentDeleteOrg to cascade-delete all Convex records
 */
export const purgeExpiredOrgs = internalAction({
  args: {},
  handler: async (ctx) => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - THIRTY_DAYS_MS;

    const expiredOrgs = await ctx.runQuery(
      internal.organisations.queries.listExpired,
      { cutoff }
    );

    if (expiredOrgs.length === 0) return;

    const secretKey = requireEnv("CLERK_SECRET_KEY");

    for (const org of expiredOrgs) {
      // 1. Collect all users in this org and delete them from Clerk
      const users = await ctx.runQuery(
        internal.users.queries.listByOrgInternal,
        { organisationId: org._id }
      );

      for (const user of users) {
        const res = await fetch(
          `https://api.clerk.com/v1/users/${user.clerkUserId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${secretKey}` },
          }
        );
        // 404 = already deleted — treat as success
        if (!res.ok && res.status !== 404) {
          console.error(
            `[purgeExpiredOrgs] Failed to delete Clerk user ${user.clerkUserId} for org ${org._id}:`,
            res.status
          );
        }
      }

      // 2. Delete all Convex records for this org
      await ctx.runMutation(
        internal.organisations.mutations.permanentDeleteOrg,
        { organisationId: org._id }
      );

      console.log(`[purgeExpiredOrgs] Permanently deleted org ${org._id} (${org.name})`);
    }
  },
});
