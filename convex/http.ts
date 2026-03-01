import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import { requireEnv } from "./env";

const http = httpRouter();

/**
 * Clerk webhook endpoint.
 *
 * Setup in Clerk Dashboard → Webhooks → Add Endpoint:
 *   URL: https://<your-convex-site-url>/clerk-webhook
 *   Events: user.created, user.updated, organizationMembership.created
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

    // ── organisation.created ─────────────────────────────────────────────────
    if (type === "organization.created") {
      await ctx.runMutation(internal.organisations.mutations.createFromClerk, {
        clerkOrgId: data.id as string,
        name: data.name as string,
        slug: (data.slug as string) ?? (data.id as string),
      });
    }

    // ── organizationMembership.created ───────────────────────────────────────
    // Fires when a user joins an org (signup or invite accepted)
    if (type === "organizationMembership.created") {
      const membership = data as {
        id: string;
        role: string;
        organization: { id: string };
        public_user_data: {
          user_id: string;
          first_name: string;
          last_name: string;
          image_url: string;
          identifier: string; // email
        };
      };

      // Find the Convex org
      const org = await ctx.runQuery(
        internal.organisations.queries.getByClerkOrgId,
        { clerkOrgId: membership.organization.id }
      );
      if (!org) {
        return new Response("Organisation not found", { status: 404 });
      }

      const clerkRole = membership.role; // "org:admin" | "org:member"
      const role =
        clerkRole === "org:admin" ? "admin" : "staff";

      const userData = membership.public_user_data;
      const fullName =
        `${userData.first_name ?? ""} ${userData.last_name ?? ""}`.trim() ||
        userData.identifier;

      // tokenIdentifier format used by Convex auth: "<issuer>|<user_id>"
      const issuerDomain = requireEnv("CLERK_JWT_ISSUER_DOMAIN");
      const tokenIdentifier = `${issuerDomain}|${userData.user_id}`;

      await ctx.runMutation(internal.users.mutations.syncFromClerk, {
        clerkUserId: userData.user_id,
        tokenIdentifier,
        email: userData.identifier,
        fullName,
        avatarUrl: userData.image_url || undefined,
        organisationId: org._id,
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
