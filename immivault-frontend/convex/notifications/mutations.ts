import { internalMutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

const notificationTypeValidator = v.union(
  v.literal("case_created"),
  v.literal("case_assigned"),
  v.literal("case_status_changed"),
  v.literal("case_deadline"),
  v.literal("case_updated"),
  v.literal("task_assigned"),
  v.literal("task_status_changed"),
  v.literal("task_overdue"),
  v.literal("task_updated"),
  v.literal("comment"),
  v.literal("mention"),
  v.literal("document_uploaded"),
  v.literal("appointment_created"),
  v.literal("appointment_updated"),
  v.literal("appointment_cancelled"),
  v.literal("appointment_pending_approval"),
  v.literal("appointment_approved"),
  v.literal("appointment_rejected"),
  v.literal("payment_dispute")
);

/** Internal: insert a single notification record. Called from internalActions. */
export const insert = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    recipientId: v.id("users"),
    type: notificationTypeValidator,
    title: v.string(),
    message: v.string(),
    entityType: v.optional(v.union(v.literal("case"), v.literal("task"), v.literal("appointment"))),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      ...args,
      read: false,
    });
  },
});

/** Mark a single notification as read. Only the recipient can mark their own. */
export const markRead = authenticatedMutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.id);
    if (!notif || notif.recipientId !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not your notification." });
    }
    await ctx.db.patch(args.id, { read: true });
  },
});

/** Mark all unread notifications as read for the current user. */
export const markAllRead = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_unread", (q) =>
        q.eq("recipientId", ctx.user._id).eq("read", false)
      )
      .collect();
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { read: true })));
  },
});
