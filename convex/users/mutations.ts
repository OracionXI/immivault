import { internalMutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { v, ConvexError } from "convex/values";

/**
 * Called by the Clerk webhook (http.ts) when a new user is created.
 * Creates the Convex user profile linked to the Clerk user.
 * For the first user in an org, `organisationId` is created beforehand
 * by the `organisations.mutations.createFromClerk` mutation.
 */
export const syncFromClerk = internalMutation({
  args: {
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    email: v.string(),
    fullName: v.string(),
    avatarUrl: v.optional(v.string()),
    organisationId: v.id("organisations"),
    role: v.union(
      v.literal("admin"),
      v.literal("attorney"),
      v.literal("paralegal"),
      v.literal("staff")
    ),
  },
  handler: async (ctx, args) => {
    // Upsert: update if exists, create if not
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        fullName: args.fullName,
        avatarUrl: args.avatarUrl,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      tokenIdentifier: args.tokenIdentifier,
      email: args.email,
      fullName: args.fullName,
      avatarUrl: args.avatarUrl,
      organisationId: args.organisationId,
      role: args.role,
      status: "active",
    });
  },
});

/**
 * Called by the Clerk webhook when a user's profile is updated.
 */
export const updateFromClerk = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (!user) return;

    await ctx.db.patch(user._id, {
      ...(args.email && { email: args.email }),
      ...(args.fullName && { fullName: args.fullName }),
      ...(args.avatarUrl !== undefined && { avatarUrl: args.avatarUrl }),
    });
  },
});

/** Admin-only: update a staff member's role and active status. */
export const updateMember = authenticatedMutation({
  args: {
    id: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("attorney"),
      v.literal("paralegal"),
      v.literal("staff")
    ),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    const member = await ctx.db.get(args.id);
    if (!member || member.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found." });
    }
    await ctx.db.patch(args.id, { role: args.role, status: args.status });
  },
});
