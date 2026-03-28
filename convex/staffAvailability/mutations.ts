import { authenticatedMutation } from "../lib/auth";
import { v, ConvexError } from "convex/values";

/**
 * Case manager / admin: replace all recurring weekly availability windows for themselves.
 * Inactive entries are not stored — the entire schedule is replaced on each save.
 */
export const upsertMyAvailability = authenticatedMutation({
  args: {
    windows: v.array(v.object({
      dayOfWeek: v.number(), // 0=Sun … 6=Sat
      startHour: v.number(), // 0–23
      endHour: v.number(),   // 1–24 (exclusive)
      isActive: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "case_manager") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins and case managers can set availability." });
    }

    for (const w of args.windows) {
      if (!Number.isInteger(w.dayOfWeek) || w.dayOfWeek < 0 || w.dayOfWeek > 6)
        throw new ConvexError({ code: "BAD_REQUEST", message: "dayOfWeek must be 0–6." });
      if (!Number.isInteger(w.startHour) || w.startHour < 0 || w.startHour > 23)
        throw new ConvexError({ code: "BAD_REQUEST", message: "startHour must be 0–23." });
      if (!Number.isInteger(w.endHour) || w.endHour < 1 || w.endHour > 24)
        throw new ConvexError({ code: "BAD_REQUEST", message: "endHour must be 1–24." });
      if (w.endHour <= w.startHour)
        throw new ConvexError({ code: "BAD_REQUEST", message: "endHour must be after startHour." });
    }

    // Delete all existing windows for this user
    const existing = await ctx.db
      .query("staffAvailability")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);

    // Insert new active windows
    for (const w of args.windows) {
      if (!w.isActive) continue;
      await ctx.db.insert("staffAvailability", {
        organisationId: ctx.user.organisationId,
        userId: ctx.user._id,
        dayOfWeek: w.dayOfWeek,
        startHour: w.startHour,
        endHour: w.endHour,
        isActive: true,
      });
    }
  },
});

/** Case manager / admin: add a blackout date (blocks all slots on that calendar date). */
export const addBlackoutDate = authenticatedMutation({
  args: {
    date: v.string(),           // "YYYY-MM-DD"
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "case_manager") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins and case managers can add blackout dates." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Date must be in YYYY-MM-DD format." });
    }

    // Reject past dates
    const today = new Date().toISOString().split("T")[0];
    if (args.date < today) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot add a blackout date in the past." });
    }

    // Prevent duplicates
    const existing = await ctx.db
      .query("staffBlackoutDates")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect()
      .then((list) => list.find((b) => b.date === args.date));

    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: "A blackout date already exists for this date." });
    }

    await ctx.db.insert("staffBlackoutDates", {
      organisationId: ctx.user.organisationId,
      userId: ctx.user._id,
      date: args.date,
      reason: args.reason,
    });
  },
});

/** Case manager / admin: remove a blackout date they own. */
export const removeBlackoutDate = authenticatedMutation({
  args: { id: v.id("staffBlackoutDates") },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "case_manager") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins and case managers can remove blackout dates." });
    }

    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== ctx.user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Blackout date not found." });
    }

    await ctx.db.delete(args.id);
  },
});
