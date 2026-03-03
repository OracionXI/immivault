import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireEnv } from "../env";
import type { Id } from "../_generated/dataModel";

/**
 * Permanently deletes a staff member from both Clerk and Convex.
 * Admin only. Cannot delete yourself.
 */
export const deleteStaff = action({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    // ── Auth & role guard ────────────────────────────────────────────────────
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated." });
    }
    const caller = await ctx.runQuery(internal.users.queries.getByToken, {
      token: identity.tokenIdentifier,
    });
    if (!caller || caller.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    if (caller._id === args.id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You cannot delete your own account." });
    }

    // ── Fetch the target user ────────────────────────────────────────────────
    const target = await ctx.runQuery(internal.users.queries.getById, { id: args.id });
    if (!target || target.organisationId !== caller.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found." });
    }

    // ── Unassign all cases and tasks belonging to this user ──────────────────
    await ctx.runMutation(internal.users.mutations.cascadeUnassign, { userId: args.id });

    // ── Delete from Clerk ────────────────────────────────────────────────────
    const secretKey = requireEnv("CLERK_SECRET_KEY");
    const res = await fetch(`https://api.clerk.com/v1/users/${target.clerkUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!res.ok && res.status !== 404) {
      const errBody = await res.json().catch(() => ({})) as { errors?: { message: string }[] };
      throw new ConvexError({
        code: "CLERK_ERROR",
        message: errBody.errors?.[0]?.message ?? "Failed to delete user from Clerk.",
      });
    }

    // ── Delete from Convex ───────────────────────────────────────────────────
    await ctx.runMutation(internal.users.mutations.remove, { id: args.id });
  },
});

/**
 * Sends a Clerk invitation email to a new staff member.
 * Caller must be an admin.
 *
 * Flow:
 *  1. Creates a tracking record in the Convex `invitations` table.
 *  2. Calls Clerk's POST /v1/invitations with public_metadata carrying
 *     the org ID and role so the user.created webhook can link them up.
 *
 * Convex env vars required:
 *   CLERK_SECRET_KEY  — set with: npx convex env set CLERK_SECRET_KEY sk_...
 */
export const inviteStaff = action({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("case_manager"),
      v.literal("staff")
    ),
  },
  handler: async (ctx, args) => {
    // ── Auth & role guard ────────────────────────────────────────────────────
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated." });
    }

    const user = await ctx.runQuery(internal.users.queries.getByToken, {
      token: identity.tokenIdentifier,
    });
    if (!user) {
      throw new ConvexError({ code: "USER_NOT_FOUND", message: "User not found." });
    }
    if (user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }

    // ── Rate limit: 10 invitations per hour per org ──────────────────────────
    await ctx.runMutation(internal.users.mutations.recordInviteRateLimit, {
      organisationId: user.organisationId,
    });

    // ── Create Convex invite record (for tracking) ───────────────────────────
    await ctx.runMutation(internal.users.mutations.createInvite, {
      organisationId: user.organisationId,
      email: args.email,
      role: args.role,
      invitedBy: user._id,
    });

    // ── Call Clerk REST API (/v1/invitations — no Clerk Orgs needed) ─────────
    const secretKey = requireEnv("CLERK_SECRET_KEY");

    const res = await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: args.email,
        // Webhook reads these to assign org + role when the user signs up.
        public_metadata: {
          convexRole: args.role,
          convexOrgId: user.organisationId,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as {
        errors?: { code?: string; message: string; long_message?: string }[];
      };
      console.error("Clerk invitation error", res.status, JSON.stringify(errBody));
      const clerkCode = errBody.errors?.[0]?.code ?? "";
      const message = clerkCode.includes("duplicate") || clerkCode.includes("already")
        ? `An invitation is already pending for ${args.email}. Revoke it in Clerk Dashboard → Users → Invitations before resending.`
        : errBody.errors?.[0]?.long_message ??
          errBody.errors?.[0]?.message ??
          "Invitation failed. Please try again.";
      throw new ConvexError({ code: "CLERK_ERROR", message });
    }
  },
});
