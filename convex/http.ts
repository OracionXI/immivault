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
        public_metadata: { convexRole?: string; convexRoleId?: string; convexOrgId?: string };
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
      const isInvitedUser = !!metaOrgId;

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
        // First admin: get existing org or create a placeholder
        organisationId = await ctx.runMutation(
          internal.organisations.mutations.getOrCreateDefault,
          {}
        );
      }

      // Determine role (permission tier) from invitation metadata, defaulting to admin
      const convexRole = user.public_metadata?.convexRole;
      const role: "admin" | "case_manager" | "staff" | "accountant" =
        convexRole === "case_manager"
          ? "case_manager"
          : convexRole === "staff"
          ? "staff"
          : convexRole === "accountant"
          ? "accountant"
          : "admin";

      // convexRoleId carries the custom display role ID (may differ from role tier)
      const roleId = user.public_metadata?.convexRoleId ?? (role !== "admin" ? role : undefined);

      // Manual admin signups start as "pending_onboarding" — they must complete
      // the /onboarding form before accessing the app.
      // Invited non-admin users start as "inactive" — admin must activate them.
      const status = isInvitedUser ? "inactive" : "pending_onboarding";

      await ctx.runMutation(internal.users.mutations.syncFromClerk, {
        clerkUserId: user.id,
        tokenIdentifier,
        email,
        fullName,
        avatarUrl: user.image_url || undefined,
        organisationId,
        role,
        roleId,
        status,
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

/**
 * Stripe webhook endpoint — per-organisation.
 *
 * Each organisation configures their Stripe webhook to point to:
 *   https://<NEXT_PUBLIC_CONVEX_SITE_URL>/stripe-webhook?orgId=<organisationId>
 *
 * Events handled:
 *   - payment_intent.succeeded
 *   - charge.refunded
 *   - charge.dispute.created
 *   - charge.dispute.updated
 *   - charge.dispute.closed
 *
 * All events are idempotent via the webhookLogs table.
 */
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get("orgId");

    if (!orgId) {
      return new Response("Missing orgId query parameter", { status: 400 });
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    // Read body exactly once before it's consumed
    const payload = await request.text();
    if (!payload) {
      return new Response("Empty request body", { status: 400 });
    }

    try {
      await ctx.runAction(internal.billing.actions.handleWebhookEvent, {
        payload,
        signature,
        organisationId: orgId as Id<"organisations">,
      });
    } catch (err) {
      // Classify error without leaking internal details to the caller.
      // Return 400 for signature failures (Stripe won't retry) and
      // 500 for processing failures (Stripe will retry automatically).
      const msg = err instanceof Error ? err.message : "";
      const isSignatureError = msg.includes("signature");
      return new Response(
        isSignatureError ? "Invalid webhook signature." : "Webhook processing failed.",
        { status: isSignatureError ? 400 : 500 }
      );
    }

    return new Response("OK", { status: 200 });
  }),
});

// ─── Portal HTTP Routes ───────────────────────────────────────────────────────
// All portal routes are server-to-server only (called from Next.js API routes).
// They accept a session hash via Authorization: Bearer header.

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Portal: Send OTP ─────────────────────────────────────────────────────────
http.route({
  path: "/portal/auth/send-otp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: { email?: string; orgSlug?: string };
    try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }
    if (!body.email || !body.orgSlug) return jsonRes({ error: "Missing email or orgSlug" }, 400);
    try {
      await ctx.runAction(internal.portal.auth.sendOtp, {
        email: body.email.toLowerCase().trim(),
        orgSlug: body.orgSlug,
      });
      return jsonRes({ ok: true });
    } catch (err) {
      return jsonRes({ error: err instanceof Error ? err.message : "Failed" }, 400);
    }
  }),
});

// ─── Portal: Verify OTP ───────────────────────────────────────────────────────
http.route({
  path: "/portal/auth/verify-otp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: { email?: string; orgSlug?: string; code?: string };
    try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }
    if (!body.email || !body.orgSlug || !body.code) return jsonRes({ error: "Missing fields" }, 400);
    try {
      const result = await ctx.runAction(internal.portal.auth.verifyOtp, {
        email: body.email.toLowerCase().trim(),
        orgSlug: body.orgSlug,
        code: body.code.trim(),
      });
      return jsonRes({ ok: true, sessionToken: result.sessionToken, orgSlug: body.orgSlug });
    } catch (err) {
      return jsonRes({ error: err instanceof Error ? err.message : "Invalid code" }, 401);
    }
  }),
});

// ─── Portal: Validate Magic Link ──────────────────────────────────────────────
// GET is intentionally NOT used for validation — email security crawlers follow
// GET links and would burn the single-use token before the user clicks.
// Kept as a stub that returns 405 to avoid surprises.
http.route({
  path: "/portal/auth/magic-link",
  method: "GET",
  handler: httpAction(async (_ctx, _request) => {
    return jsonRes({ error: "Use POST to validate a magic link." }, 405);
  }),
});

// POST-only: validates token from request body (crawlers don't POST)
http.route({
  path: "/portal/auth/magic-link",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: { token?: string; org?: string };
    try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }
    const { token: rawToken, org: orgSlug } = body;
    if (!rawToken || !orgSlug) return jsonRes({ error: "Missing token or org" }, 400);
    try {
      const result = await ctx.runAction(internal.portal.auth.validateMagicLink, { rawToken, orgSlug });
      return jsonRes({ ok: true, sessionToken: result.sessionToken, orgSlug: result.orgSlug });
    } catch (err) {
      return jsonRes({ error: err instanceof Error ? err.message : "Invalid link" }, 401);
    }
  }),
});

// ─── Portal: Logout ───────────────────────────────────────────────────────────
http.route({
  path: "/portal/auth/logout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const sessionHash = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    if (sessionHash) {
      await ctx.runMutation(internal.portal.auth.deleteSession, { sessionHash });
    }
    return jsonRes({ ok: true });
  }),
});

// ─── Portal Data Routes ───────────────────────────────────────────────────────

http.route({
  path: "/portal/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    await ctx.runMutation(internal.portal.auth.touchSession, { sessionId: session.sessionId });
    const [stats, unreadCount] = await Promise.all([
      ctx.runQuery(internal.portal.queries.getDashboardStats, {
        clientId: session.clientId,
        organisationId: session.organisationId,
      }),
      ctx.runQuery(internal.portal.queries.getUnreadNotificationCount, {
        clientId: session.clientId,
        organisationId: session.organisationId,
      }),
    ]);
    return jsonRes({ client: session.client, org: session.org, stats, unreadCount, profileCompleted: session.profileCompleted, sessionId: session.sessionId, clientId: session.clientId, organisationId: session.organisationId });
  }),
});

// ─── Portal: Get / Update Client Profile ─────────────────────────────────────
http.route({
  path: "/portal/profile",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    const profile = await ctx.runQuery(internal.portal.queries.getClientProfile, {
      clientId: session.clientId,
      organisationId: session.organisationId,
    });
    return jsonRes({ profile });
  }),
});

http.route({
  path: "/portal/profile",
  method: "PUT",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }
    await ctx.runMutation(internal.portal.mutations.updateClientProfile, {
      clientId: session.clientId,
      organisationId: session.organisationId,
      prefix: typeof body.prefix === "string" ? body.prefix : undefined,
      middleName: typeof body.middleName === "string" ? body.middleName : undefined,
      dateOfBirth: typeof body.dateOfBirth === "number" ? body.dateOfBirth : undefined,
      maritalStatus: typeof body.maritalStatus === "string" ? body.maritalStatus : undefined,
      languagePreference: typeof body.languagePreference === "string" ? body.languagePreference : undefined,
      nationality: typeof body.nationality === "string" ? body.nationality : undefined,
      countryOfBirth: typeof body.countryOfBirth === "string" ? body.countryOfBirth : undefined,
      passportNumber: typeof body.passportNumber === "string" ? body.passportNumber : undefined,
      mobilePhone: typeof body.mobilePhone === "string" ? body.mobilePhone : undefined,
      address: typeof body.address === "string" ? body.address : undefined,
      markComplete: body.markComplete === true,
    });
    return jsonRes({ ok: true });
  }),
});

http.route({
  path: "/portal/cases",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    const cases = await ctx.runQuery(internal.portal.queries.getCases, {
      clientId: session.clientId,
      organisationId: session.organisationId,
    });
    return jsonRes({ cases });
  }),
});

// GET /portal/cases/detail?caseId=xxx — case notes, documents, external comments
http.route({
  path: "/portal/cases/detail",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");
    if (!caseId) return jsonRes({ error: "Missing caseId" }, 400);
    const detail = await ctx.runQuery(internal.portal.queries.getCaseDetail, {
      caseId: caseId as Id<"cases">,
      clientId: session.clientId,
      organisationId: session.organisationId,
    });
    if (!detail) return jsonRes({ error: "Not found" }, 404);
    return jsonRes({ detail });
  }),
});

// GET /portal/document-url?docId=xxx — signed view URL for a portal document
http.route({
  path: "/portal/document-url",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    const url = new URL(request.url);
    const docId = url.searchParams.get("docId");
    if (!docId) return jsonRes({ error: "Missing docId" }, 400);
    const viewUrl = await ctx.runQuery(internal.portal.queries.getDocumentUrl, {
      docId: docId as Id<"documents">,
      clientId: session.clientId,
      organisationId: session.organisationId,
    });
    if (!viewUrl) return jsonRes({ error: "Not found" }, 404);
    return jsonRes({ url: viewUrl });
  }),
});

// POST /portal/cases/comment — client posts an external comment
http.route({
  path: "/portal/cases/comment",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    let body: { caseId?: string; body?: string };
    try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }
    if (!body.caseId || !body.body?.trim()) return jsonRes({ error: "Missing caseId or body" }, 400);
    try {
      await ctx.runMutation(internal.comments.mutations.createPortalComment, {
        caseId: body.caseId as Id<"cases">,
        clientId: session.clientId,
        organisationId: session.organisationId,
        body: body.body,
      });
      return jsonRes({ ok: true });
    } catch (err) {
      return jsonRes({ error: err instanceof Error ? err.message : "Failed" }, 400);
    }
  }),
});

http.route({
  path: "/portal/invoices",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    const [invoices, paymentLinks] = await Promise.all([
      ctx.runQuery(internal.portal.queries.getInvoices, {
        clientId: session.clientId,
        organisationId: session.organisationId,
      }),
      ctx.runQuery(internal.portal.queries.getPaymentLinks, {
        clientId: session.clientId,
        organisationId: session.organisationId,
      }),
    ]);
    return jsonRes({ invoices, paymentLinks });
  }),
});

http.route({
  path: "/portal/payments",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    const [payments, contractSummary] = await Promise.all([
      ctx.runQuery(internal.portal.queries.getPayments, {
        clientId: session.clientId,
        organisationId: session.organisationId,
      }),
      ctx.runQuery(internal.portal.queries.getContractSummary, {
        clientId: session.clientId,
        organisationId: session.organisationId,
      }),
    ]);
    return jsonRes({ payments, contractSummary });
  }),
});

// ─── Portal: Case fee checkout ────────────────────────────────────────────────
http.route({
  path: "/portal/payments/case-fee-checkout",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);

    let body: { amountCents?: number; nextPaymentDate?: number };
    try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }

    const { amountCents, nextPaymentDate } = body;

    if (typeof amountCents !== "number" || amountCents < 100) {
      return jsonRes({ error: "amountCents must be at least 100 (£1.00)." }, 400);
    }

    // nextPaymentDate must be within 60 days if provided
    if (nextPaymentDate !== undefined) {
      const now = Date.now();
      if (typeof nextPaymentDate !== "number" || nextPaymentDate <= now) {
        return jsonRes({ error: "nextPaymentDate must be a future timestamp." }, 400);
      }
      if (nextPaymentDate > now + 60 * 24 * 60 * 60_000) {
        return jsonRes({ error: "nextPaymentDate cannot be more than 60 days from now." }, 400);
      }
    }

    try {
      const { clientSecret, publishableKey, currency } = await ctx.runAction(
        internal.portal.actions.createCaseFeePaymentIntent,
        { organisationId: session.organisationId, clientId: session.clientId, amountCents, nextPaymentDate }
      );

      return jsonRes({ clientSecret, publishableKey, currency });
    } catch (err) {
      return jsonRes({ error: err instanceof Error ? err.message : "Checkout failed." }, 400);
    }
  }),
});

// ─── Portal: Confirm case fee payment ────────────────────────────────────────
http.route({
  path: "/portal/payments/confirm-case-fee",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);

    let body: { paymentIntentId?: string };
    try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }
    if (!body.paymentIntentId) return jsonRes({ error: "paymentIntentId is required." }, 400);

    try {
      await ctx.runAction(internal.portal.actions.confirmCaseFeePayment, {
        stripePaymentIntentId: body.paymentIntentId,
        organisationId: session.organisationId,
      });
      return jsonRes({ ok: true });
    } catch (err) {
      return jsonRes({ error: err instanceof Error ? err.message : "Confirmation failed." }, 400);
    }
  }),
});

http.route({
  path: "/portal/appointments",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    const [appointments, pricing] = await Promise.all([
      ctx.runQuery(internal.portal.queries.getAppointments, {
        clientId: session.clientId,
        organisationId: session.organisationId,
      }),
      ctx.runQuery(internal.portal.queries.getAppointmentPricing, {
        organisationId: session.organisationId,
      }),
    ]);
    return jsonRes({ appointments, pricing });
  }),
});

http.route({
  path: "/portal/notifications",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    const notifications = await ctx.runQuery(internal.portal.queries.getNotifications, {
      clientId: session.clientId,
      organisationId: session.organisationId,
    });
    await ctx.runMutation(internal.portal.mutations.markAllNotificationsRead, {
      clientId: session.clientId,
      organisationId: session.organisationId,
    });
    return jsonRes({ notifications });
  }),
});

http.route({
  path: "/portal/appointment-pricing",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    const pricing = await ctx.runQuery(internal.portal.queries.getAppointmentPricing, {
      organisationId: session.organisationId,
    });
    return jsonRes({ pricing });
  }),
});

// ─── Portal: Get available slots for a date ───────────────────────────────────
http.route({
  path: "/portal/appointments/slots",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const pricingId = url.searchParams.get("pricingId");
    const dateStartUTC = parseInt(url.searchParams.get("dateStartUTC") ?? "0", 10);
    const dayOfWeek = parseInt(url.searchParams.get("dayOfWeek") ?? "-1", 10);

    if (!pricingId || isNaN(dateStartUTC) || isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return jsonRes({ error: "pricingId, dateStartUTC, and dayOfWeek are required." }, 400);
    }

    const slots = await ctx.runQuery(internal.appointmentAvailability.queries.getAvailableSlots, {
      organisationId: session.organisationId,
      appointmentPricingId: pricingId as Id<"appointmentPricing">,
      dateStartUTC,
      dayOfWeek,
    });

    return jsonRes({ slots });
  }),
});

// ─── Portal: Get available offline slots (org office hours) ──────────────────
http.route({
  path: "/portal/appointments/offline-slots",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const dateStartUTC = parseInt(url.searchParams.get("dateStartUTC") ?? "0", 10);
    const dayOfWeek = parseInt(url.searchParams.get("dayOfWeek") ?? "-1", 10);

    if (isNaN(dateStartUTC) || isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return jsonRes({ error: "dateStartUTC and dayOfWeek are required." }, 400);
    }

    const slots = await ctx.runQuery(internal.appointmentAvailability.queries.getOfflineSlots, {
      organisationId: session.organisationId,
      dateStartUTC,
      dayOfWeek,
    });

    return jsonRes({ slots });
  }),
});

// ─── Portal: Get client's cases for booking ───────────────────────────────────
http.route({
  path: "/portal/appointments/cases",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);

    const [cases, orgSettings] = await Promise.all([
      ctx.runQuery(internal.portal.queries.getCasesForBooking, {
        clientId: session.clientId,
        organisationId: session.organisationId,
      }),
      ctx.runQuery(internal.portal.queries.getOrgSettings, {
        organisationId: session.organisationId,
      }),
    ]);

    return jsonRes({ cases, orgTimezone: orgSettings.timezone });
  }),
});

// ─── Portal: Book appointment ─────────────────────────────────────────────────
http.route({
  path: "/portal/appointments/book",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);

    let body: { appointmentPricingId: string; startAt: number; durationMinutes: number; caseId?: string; modality?: "online" | "offline" };
    try {
      body = await request.json();
    } catch {
      return jsonRes({ error: "Invalid JSON body." }, 400);
    }

    const { appointmentPricingId, startAt, durationMinutes, caseId } = body;
    const modality: "online" | "offline" = body.modality === "offline" ? "offline" : "online";

    if (!appointmentPricingId || !startAt || !durationMinutes) {
      return jsonRes({ error: "appointmentPricingId, startAt, and durationMinutes are required." }, 400);
    }
    const now = Date.now();
    if (typeof startAt !== "number" || startAt < now) {
      return jsonRes({ error: "Appointment start time must be in the future." }, 400);
    }
    // Upper bound: 30 days
    if (startAt > now + 30 * 24 * 60 * 60 * 1000) {
      return jsonRes({ error: "Appointment cannot be booked more than 30 days in advance." }, 400);
    }
    if (typeof durationMinutes !== "number" || durationMinutes < 5 || durationMinutes > 480) {
      return jsonRes({ error: "Duration must be between 5 and 480 minutes." }, 400);
    }

    // Fetch active pricing
    const pricing = await ctx.runQuery(internal.portal.queries.getAppointmentPricing, {
      organisationId: session.organisationId,
    });
    const selected = pricing.find((p: { _id: string }) => p._id === appointmentPricingId);
    if (!selected) return jsonRes({ error: "Appointment type not found or inactive." }, 404);

    // Validate caseId — for online also require Google Calendar connection
    let theCase: { _id: string; assigneeId: string | null; assigneeGoogleConnected: boolean } | undefined;
    if (caseId) {
      const cases = await ctx.runQuery(internal.portal.queries.getCasesForBooking, {
        clientId: session.clientId,
        organisationId: session.organisationId,
      });
      theCase = cases.find((c: { _id: string }) => c._id === caseId);
      if (!theCase) return jsonRes({ error: "Case not found." }, 404);
      if (!theCase.assigneeId) {
        return jsonRes({ error: "No case manager assigned. Please contact the office." }, 422);
      }
      if (modality === "online" && !theCase.assigneeGoogleConnected) {
        return jsonRes({ error: "Online meetings unavailable. Please contact the office." }, 422);
      }
    }

    // Rate limit: max 5 booking attempts per client per hour
    try {
      await ctx.runMutation(internal.billing.mutations.checkRateLimitPublic, {
        key: `apptBook:${session.clientId}`,
        maxRequests: 5,
        windowMs: 3_600_000,
      });
    } catch {
      return jsonRes({ error: "Too many booking requests. Please try again later." }, 429);
    }

    // Offline appointments: always book immediately (payment handled later by office)
    // Zero-price online: also book immediately, no payment
    if (modality === "offline" || selected.priceInCents === 0) {
      await ctx.runMutation(internal.portal.mutations.bookFreeAppointment, {
        organisationId: session.organisationId,
        clientId: session.clientId,
        caseId: caseId as Id<"cases"> | undefined,
        appointmentType: selected.appointmentType,
        startAt,
        endAt: startAt + durationMinutes * 60_000,
        hostUserId: (theCase?.assigneeId ?? undefined) as Id<"users"> | undefined,
        modality,
      });
      return jsonRes({ booked: true });
    }

    // Online paid: create Stripe PaymentIntent directly — no payment link created
    try {
      const result = await ctx.runAction(internal.portal.actions.createAppointmentPaymentIntent, {
        organisationId: session.organisationId,
        clientId: session.clientId,
        amountCents: selected.priceInCents,
        appointmentType: selected.appointmentType,
        startAt,
        durationMinutes,
        caseId: caseId as Id<"cases"> | undefined,
        modality,
        hostUserId: (theCase?.assigneeId ?? undefined) as Id<"users"> | undefined,
      });
      return jsonRes(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment initialisation failed.";
      return jsonRes({ error: msg }, 422);
    }
  }),
});

// ─── Portal: Confirm appointment payment (direct PI — no payment link) ────────
http.route({
  path: "/portal/appointments/confirm-payment",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);

    let body: { paymentIntentId?: string };
    try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON body." }, 400); }
    if (!body.paymentIntentId) return jsonRes({ error: "paymentIntentId is required." }, 400);

    try {
      await ctx.runAction(internal.portal.actions.confirmAppointmentPayment, {
        stripePaymentIntentId: body.paymentIntentId,
        organisationId: session.organisationId,
        clientId: session.clientId,
      });
      return jsonRes({ confirmed: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment confirmation failed.";
      return jsonRes({ error: msg }, 500);
    }
  }),
});

// ─── Portal: Cancel appointment ───────────────────────────────────────────────
http.route({
  path: "/portal/appointments/cancel",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);

    let body: { appointmentId?: string };
    try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }
    if (!body.appointmentId) return jsonRes({ error: "appointmentId is required." }, 400);

    try {
      const result = await ctx.runMutation(internal.portal.mutations.cancelPortalAppointment, {
        appointmentId: body.appointmentId as Id<"appointments">,
        clientId: session.clientId,
        organisationId: session.organisationId,
      });
      return jsonRes({ ok: true, refundInitiated: result?.refundInitiated ?? false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel appointment.";
      return jsonRes({ error: msg }, 400);
    }
  }),
});

// ─── Portal: Reschedule appointment ───────────────────────────────────────────
http.route({
  path: "/portal/appointments/reschedule",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);

    let body: { appointmentId?: string; newStartAt?: number; durationMinutes?: number };
    try { body = await request.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }
    if (!body.appointmentId || !body.newStartAt || !body.durationMinutes) {
      return jsonRes({ error: "appointmentId, newStartAt, and durationMinutes are required." }, 400);
    }

    const now = Date.now();
    if (body.newStartAt < now + 60 * 60_000) {
      return jsonRes({ error: "New time must be at least 1 hour from now." }, 400);
    }
    if (body.newStartAt > now + 30 * 24 * 60 * 60_000) {
      return jsonRes({ error: "Cannot reschedule more than 30 days in advance." }, 400);
    }

    try {
      await ctx.runMutation(internal.portal.mutations.reschedulePortalAppointment, {
        appointmentId: body.appointmentId as Id<"appointments">,
        clientId: session.clientId,
        organisationId: session.organisationId,
        newStartAt: body.newStartAt,
        newEndAt: body.newStartAt + body.durationMinutes * 60_000,
      });
      return jsonRes({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reschedule appointment.";
      return jsonRes({ error: msg }, 400);
    }
  }),
});

// ─── Portal: Dashboard Detail ──────────────────────────────────────────────────
http.route({
  path: "/portal/dashboard",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hash = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!hash) return jsonRes({ error: "Unauthorized" }, 401);
    const session = await ctx.runQuery(internal.portal.auth.verifySession, { sessionHash: hash });
    if (!session) return jsonRes({ error: "Unauthorized" }, 401);
    const detail = await ctx.runQuery(internal.portal.queries.getDashboardDetail, {
      clientId: session.clientId,
      organisationId: session.organisationId,
    });
    return jsonRes(detail);
  }),
});

export default http;
