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

    // ── Founder protection ───────────────────────────────────────────────────
    if (target.isFounder && !caller.isFounder) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "The organisation founder can only be removed by themselves.",
      });
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
    roleId: v.string(), // custom role ID or "case_manager"/"staff" for built-ins
    redirectUrl: v.optional(v.string()), // frontend passes window.location.origin + "/invite"
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

    // ── Resolve permission tier from org's customRoles ───────────────────────
    const settings = await ctx.runQuery(internal.organisations.queries.getSettingsInternal, {
      organisationId: user.organisationId,
    });
    const customRoles = settings?.customRoles ?? [
      { id: "case_manager", permissionLevel: "case_manager" as const, name: "Case Manager", isDefault: true },
      { id: "staff",        permissionLevel: "staff"        as const, name: "Staff",         isDefault: true },
      { id: "accountant",   permissionLevel: "accountant"   as const, name: "Accountant",    isDefault: true },
    ];
    const customRole = customRoles.find((r: { id: string }) => r.id === args.roleId);
    if (!customRole) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Role not found in organisation settings." });
    }
    const permissionLevel = (customRole as { permissionLevel: "case_manager" | "staff" | "accountant" }).permissionLevel;

    // ── Rate limit: 10 invitations per hour per org ──────────────────────────
    await ctx.runMutation(internal.users.mutations.recordInviteRateLimit, {
      organisationId: user.organisationId,
    });

    // ── Global email uniqueness — internal users must be unique across all orgs ──
    const normalizedEmail = args.email.toLowerCase();
    const [existingUser, existingInviteGlobal] = await Promise.all([
      ctx.runQuery(internal.users.queries.getByEmailGlobal, { email: normalizedEmail }),
      ctx.runQuery(internal.users.queries.getInviteByEmailGlobal, { email: normalizedEmail }),
    ]);
    if (existingUser && existingUser.organisationId !== user.organisationId) {
      throw new ConvexError({
        code: "EMAIL_TAKEN",
        message: `${args.email} is already a member of another organisation and cannot be invited.`,
      });
    }
    if (existingInviteGlobal && existingInviteGlobal.organisationId !== user.organisationId) {
      throw new ConvexError({
        code: "EMAIL_TAKEN",
        message: `${args.email} already has a pending invitation to another organisation.`,
      });
    }

    const secretKey = requireEnv("CLERK_SECRET_KEY");
    const ONE_DAY = 24 * 60 * 60 * 1000;

    // ── Check for an existing pending invite (same org) ──────────────────────
    const existing = await ctx.runQuery(internal.users.queries.getInviteByEmail, {
      organisationId: user.organisationId,
      email: normalizedEmail,
    });

    if (existing) {
      const age = Date.now() - existing._creationTime;
      if (age < ONE_DAY) {
        throw new ConvexError({
          code: "INVITE_PENDING",
          message: `An invitation was already sent to ${args.email}. Please wait 24 hours before resending.`,
        });
      }
      // Older than 24 hours — revoke the stale Clerk invitation then clean up
      if (existing.clerkInvitationId) {
        await fetch(
          `https://api.clerk.com/v1/invitations/${existing.clerkInvitationId}/revoke`,
          { method: "POST", headers: { Authorization: `Bearer ${secretKey}` } }
        ).catch(() => {}); // silently ignore if already consumed/expired
      }
      await ctx.runMutation(internal.users.mutations.deleteInvite, { id: existing._id });
    }

    // ── Call Clerk REST API (/v1/invitations — no Clerk Orgs needed) ─────────
    const res = await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: normalizedEmail,
        // redirect_url tells Clerk where to send the user in the invite email.
        // Clerk appends ?__clerk_ticket=<token> to this URL.
        ...(args.redirectUrl ? { redirect_url: args.redirectUrl } : {}),
        // Webhook reads these to assign org + role when the user signs up.
        // convexRole carries the permission tier (backwards compat).
        // convexRoleId carries the display role ID for custom roles.
        public_metadata: {
          convexRole: permissionLevel,
          convexRoleId: args.roleId,
          convexOrgId: user.organisationId,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as {
        errors?: { code?: string; message: string; long_message?: string }[];
      };
      console.error("Clerk invitation error", res.status, JSON.stringify(errBody));
      const message =
        errBody.errors?.[0]?.long_message ??
        errBody.errors?.[0]?.message ??
        "Invitation failed. Please try again.";
      throw new ConvexError({ code: "CLERK_ERROR", message });
    }

    // ── Create Convex invite record (store Clerk invitation ID) ──────────────
    const clerkData = await res.json().catch(() => ({})) as { id?: string; url?: string };
    await ctx.runMutation(internal.users.mutations.createInvite, {
      organisationId: user.organisationId,
      email: normalizedEmail,
      role: permissionLevel,
      roleId: args.roleId,
      invitedBy: user._id,
      clerkInvitationId: clerkData.id,
    });

    // Return the invite URL so the frontend can display a copy-link fallback
    // (useful when Clerk dev-instance email delivery is unreliable).
    return { inviteUrl: clerkData.url ?? null };
  },
});
