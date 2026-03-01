import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const create = authenticatedMutation({
  args: {
    entityType: v.union(v.literal("case"), v.literal("task")),
    entityId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("comments", {
      ...args,
      organisationId: ctx.user.organisationId,
      authorId: ctx.user._id,
    });
  },
});

/** Only the comment author can delete their own comment. */
export const remove = authenticatedMutation({
  args: { id: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment || comment.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Comment not found." });
    }
    if (comment.authorId !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can only delete your own comments." });
    }
    await ctx.db.delete(args.id);
  },
});
