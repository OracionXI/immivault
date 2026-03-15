import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/** List appointments scoped by role.
 *  Admin: all org appointments (excluding hard-purged).
 *  Case manager: appointments where they are the creator, host (assignedTo), or an attendee.
 *  includeExpired: if true, includes Expired and Cancelled (for history view).
 */
export const list = authenticatedQuery({
  args: { includeExpired: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("appointments")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .order("desc")
      .collect();

    const filtered = args.includeExpired
      ? all
      : all.filter((a) => a.status !== "Expired" && a.status !== "Cancelled");

    if (ctx.user.role === "admin") return filtered;

    // Case manager / staff: only appointments they are involved in
    return filtered.filter(
      (a) =>
        a.createdBy === ctx.user._id ||
        a.assignedTo === ctx.user._id ||
        (a.attendees ?? []).some((att) => att.userId === ctx.user._id)
    );
  },
});

/** Upcoming and Ongoing appointments ordered by start time (used for the table + calendar). */
export const listUpcoming = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const upcoming = await ctx.db
      .query("appointments")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", ctx.user.organisationId).eq("status", "Upcoming")
      )
      .collect();

    const ongoing = await ctx.db
      .query("appointments")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", ctx.user.organisationId).eq("status", "Ongoing")
      )
      .collect();

    const combined = [...upcoming, ...ongoing].sort((a, b) => a.startAt - b.startAt);

    if (ctx.user.role === "admin") return combined;

    return combined.filter(
      (a) =>
        a.createdBy === ctx.user._id ||
        a.assignedTo === ctx.user._id ||
        (a.attendees ?? []).some((att) => att.userId === ctx.user._id)
    );
  },
});

/** Check if a given user has any overlapping appointments in a time range.
 *  Returns conflicting appointments (excluding the given appointmentId if editing). */
export const checkConflict = authenticatedQuery({
  args: {
    userId: v.id("users"),
    startAt: v.number(),
    endAt: v.number(),
    excludeId: v.optional(v.id("appointments")),
  },
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("appointments")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "Cancelled"),
          q.neq(q.field("status"), "Expired")
        )
      )
      .collect();

    return active.filter((a) => {
      if (args.excludeId && a._id === args.excludeId) return false;

      // Check if user is involved
      const isInvolved =
        a.assignedTo === args.userId ||
        a.createdBy === args.userId ||
        (a.attendees ?? []).some((att) => att.userId === args.userId);

      if (!isInvolved) return false;

      // Check time overlap: [startAt, endAt) overlaps [a.startAt, a.endAt)
      return args.startAt < a.endAt && args.endAt > a.startAt;
    });
  },
});

/** Single appointment by ID. */
export const get = authenticatedQuery({
  args: { id: v.id("appointments") },
  handler: async (ctx, args) => {
    const appt = await ctx.db.get(args.id);
    if (!appt || appt.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment not found." });
    }
    return appt;
  },
});

/** Internal: get appointment by ID (used by notification jobs). */
export const getById = internalQuery({
  args: { id: v.id("appointments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
