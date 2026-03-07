import { authenticatedQuery } from "../lib/auth";

/** Real-time unread count for the current user — drives the bell badge. */
export const getUnreadCount = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_unread", (q) =>
        q.eq("recipientId", ctx.user._id).eq("read", false)
      )
      .collect();
    return unread.length;
  },
});

/** 20 most recent notifications for the current user (read + unread). */
export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", ctx.user._id))
      .order("desc")
      .take(20);
  },
});
