import { internalMutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { v, ConvexError } from "convex/values";
import { checkRateLimit } from "../lib/rateLimit";

/**
 * Called by the Clerk webhook (http.ts) when a new user joins an org.
 * Creates the Convex user profile linked to the Clerk user.
 * Non-admin users default to status "inactive" — admin must activate them.
 * Manual admin signups pass status "pending_onboarding" explicitly so the
 * user is gated until they complete the /onboarding form.
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
      v.literal("case_manager"),
      v.literal("staff")
    ),
    // Optional override: if provided, bypasses the role-based status default.
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("pending_onboarding")
      )
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

    // Explicit status wins; otherwise default by role (admins active, others inactive)
    const status =
      args.status ?? (args.role === "admin" ? "active" : "inactive");

    return await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      tokenIdentifier: args.tokenIdentifier,
      email: args.email,
      fullName: args.fullName,
      avatarUrl: args.avatarUrl,
      organisationId: args.organisationId,
      role: args.role,
      status,
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

/**
 * Internal: records a pending staff invitation for tracking purposes.
 * Called by the inviteStaff action before sending the Clerk invitation.
 */
export const createInvite = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    email: v.string(),
    role: v.union(v.literal("case_manager"), v.literal("staff")),
    invitedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    // 24-hour expiry
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    await ctx.db.insert("invitations", {
      organisationId: args.organisationId,
      email: args.email,
      role: args.role,
      invitedBy: args.invitedBy,
      used: false,
      expiresAt,
    });
  },
});

/**
 * Internal: rate-limit gate for staff invitations.
 * Max 10 invitations per hour per organisation.
 */
export const recordInviteRateLimit = internalMutation({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    await checkRateLimit(ctx, `inviteStaff:${args.organisationId}`, 10, 3_600_000);
  },
});

/**
 * Internal: unassigns all cases and tasks belonging to a user before deletion.
 * Called by the deleteStaff action prior to removing the user record.
 */
export const cascadeUnassign = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_assigned", (q) => q.eq("assignedTo", args.userId))
      .collect();
    for (const c of cases) {
      await ctx.db.patch(c._id, { assignedTo: undefined });
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_assigned", (q) => q.eq("assignedTo", args.userId))
      .collect();
    for (const t of tasks) {
      await ctx.db.patch(t._id, { assignedTo: undefined });
    }
  },
});

/** Internal: permanently removes a user record from Convex. */
export const remove = internalMutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/** Updates the current user's own display name. Available to all authenticated users. */
export const updateProfile = authenticatedMutation({
  args: {
    fullName: v.string(),
  },
  handler: async (ctx, args) => {
    const fullName = args.fullName.trim();
    if (fullName.length < 2) {
      throw new ConvexError({ code: "VALIDATION", message: "Full name must be at least 2 characters." });
    }
    await ctx.db.patch(ctx.user._id, { fullName });
  },
});

/** Admin-only: update a staff member's role and activation status. */
export const updateMember = authenticatedMutation({
  args: {
    id: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("case_manager"),
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

    // Single-admin constraint: prevent assigning admin to a non-admin member
    if (args.role === "admin" && member.role !== "admin") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Each organisation can have only one admin.",
      });
    }
    // Single-admin constraint: prevent demoting the only admin
    if (member.role === "admin" && args.role !== "admin") {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Cannot change the admin's role. Each organisation must have exactly one admin.",
      });
    }

    await ctx.db.patch(args.id, { role: args.role, status: args.status });
  },
});
