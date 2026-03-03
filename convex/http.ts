import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import { requireEnv } from "./env";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

/**
 * Clerk webhook endpoint.
 *
 * Setup in Clerk Dashboard → Webhooks → Add Endpoint:
 *   URL: https://<your-convex-site-url>/clerk-webhook
 *   Events: user.created, user.updated
 *
 * Copy the Signing Secret into Convex env vars as CLERK_WEBHOOK_SECRET.
 */
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = requireEnv("CLERK_WEBHOOK_SECRET");

    // Verify Svix signature headers
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing Svix headers", { status: 400 });
    }

    const body = await request.text();
    const wh = new Webhook(webhookSecret);

    let evt: { type: string; data: Record<string, unknown> };
    try {
      evt = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as typeof evt;
    } catch {
      return new Response("Invalid webhook signature", { status: 400 });
    }

    const { type, data } = evt;

    // ── user.created ─────────────────────────────────────────────────────────
    // Fires when a new user signs up (admin first-time, or staff via invitation).
    if (type === "user.created") {
      const user = data as {
        id: string;
        first_name: string;
        last_name: string;
        image_url: string;
        email_addresses: { email_address: string; id: string }[];
        primary_email_address_id: string;
        public_metadata: { convexRole?: string; convexOrgId?: string };
      };

      const primaryEmail = user.email_addresses.find(
        (e) => e.id === user.primary_email_address_id
      );
      const email = primaryEmail?.email_address ?? "";
      const fullName =
        `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || email;

      const issuerDomain = requireEnv("CLERK_JWT_ISSUER_DOMAIN");
      const tokenIdentifier = `${issuerDomain}|${user.id}`;

      // Resolve the organisation:
      // - Invited staff: convexOrgId is set in public_metadata by inviteStaff
      // - First admin signup: no metadata → get or create the default org
      const metaOrgId = user.public_metadata?.convexOrgId;
      let organisationId: Id<"organisations">;

      if (metaOrgId) {
        const org = await ctx.runQuery(internal.organisations.queries.getById, {
          id: metaOrgId as Id<"organisations">,
        });
        // If the org ID in metadata is stale (e.g. org was deleted and recreated),
        // fall back to the current active org rather than failing.
        if (org) {
          organisationId = org._id;
        } else {
          organisationId = await ctx.runMutation(
            internal.organisations.mutations.getOrCreateDefault,
            {}
          );
        }
      } else {
        // First admin: get existing org or create a default one
        organisationId = await ctx.runMutation(
          internal.organisations.mutations.getOrCreateDefault,
          {}
        );
      }

      // Determine role from invitation metadata, defaulting to admin
      const convexRole = user.public_metadata?.convexRole;
      const role: "admin" | "case_manager" | "staff" =
        convexRole === "case_manager"
          ? "case_manager"
          : convexRole === "staff"
          ? "staff"
          : "admin";

      await ctx.runMutation(internal.users.mutations.syncFromClerk, {
        clerkUserId: user.id,
        tokenIdentifier,
        email,
        fullName,
        avatarUrl: user.image_url || undefined,
        organisationId,
        role,
      });
    }

    // ── user.updated ─────────────────────────────────────────────────────────
    if (type === "user.updated") {
      const user = data as {
        id: string;
        first_name: string;
        last_name: string;
        image_url: string;
        email_addresses: { email_address: string; id: string }[];
        primary_email_address_id: string;
      };

      const primaryEmail = user.email_addresses.find(
        (e) => e.id === user.primary_email_address_id
      );

      await ctx.runMutation(internal.users.mutations.updateFromClerk, {
        clerkUserId: user.id,
        email: primaryEmail?.email_address,
        fullName:
          `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
          undefined,
        avatarUrl: user.image_url || undefined,
      });
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
