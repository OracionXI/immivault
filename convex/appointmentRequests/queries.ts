import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/rbac";

/** Admin-only: list appointment requests for the org with optional status filter. */
export const list = authenticatedQuery({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("awaiting_payment"),
      v.literal("paid"),
      v.literal("rejected"),
      v.literal("payment_expired"),
      v.literal("accepted_as_client"),
      v.literal("declined_after_meeting"),
    )),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    if (args.status !== undefined) {
      return await ctx.db
        .query("appointmentRequests")
        .withIndex("by_org_and_status", (q) =>
          q.eq("organisationId", ctx.user.organisationId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("appointmentRequests")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .order("desc")
      .collect();
  },
});

/** Admin-only: confirmed/paid prospects not yet converted to a client. Used by the New Client modal dropdown. */
export const listConvertible = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    requireAdmin(ctx);
    const confirmed = await ctx.db
      .query("appointmentRequests")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", ctx.user.organisationId).eq("status", "confirmed")
      )
      .collect();
    const paid = await ctx.db
      .query("appointmentRequests")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", ctx.user.organisationId).eq("status", "paid")
      )
      .collect();
    return [...confirmed, ...paid].filter((r) => !r.convertedClientId);
  },
});

/** Internal — used by HTTP actions. */
export const getById = internalQuery({
  args: { id: v.id("appointmentRequests") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});
