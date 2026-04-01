import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v, ConvexError } from "convex/values";
import Stripe from "stripe";
import { decryptSecret, isEncrypted } from "../lib/crypto";
import type { Id } from "../_generated/dataModel";

async function resolveSecretKey(
  settings: { stripeSecretKey?: string; stripeSecretKeyEnc?: string }
): Promise<string | null> {
  if (settings.stripeSecretKeyEnc) {
    const masterKey = process.env.STRIPE_MASTER_KEY;
    if (!masterKey) return null;
    return decryptSecret(settings.stripeSecretKeyEnc, masterKey);
  }
  return settings.stripeSecretKey ?? null;
}

// ── Stripe currency set (subset) ─────────────────────────────────────────────
const STRIPE_CURRENCIES = new Set([
  "usd","eur","gbp","aud","cad","nzd","chf","sek","nok","dkk","jpy","cny",
  "hkd","sgd","myr","idr","thb","php","inr","pkr","bdt","lkr","ngn","kes",
  "zar","aed","sar","qar","egp","brl","mxn","ars","clp","cop","pen","czk",
  "pln","huf","ron","bgn","try","ils","isk",
]);

/**
 * Create a Stripe PaymentIntent for a portal client-initiated case fee payment.
 * clientId and nextPaymentDate are embedded in PI metadata — nothing is written
 * to the DB at this point. Payment is recorded only after it succeeds.
 */
export const createCaseFeePaymentIntent = internalAction({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    amountCents: v.number(),
    nextPaymentDate: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ clientSecret: string; publishableKey: string; currency: string }> => {
    const settings = await ctx.runQuery(internal.organisations.queries.getSettingsInternal, {
      organisationId: args.organisationId,
    });
    if (!settings?.stripeEnabled || !settings.stripePublishableKey) {
      throw new ConvexError("Online card payments are not enabled for this organisation.");
    }
    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) {
      throw new ConvexError("Stripe is not configured for this organisation.");
    }
    const rawCurrency = (settings.defaultCurrency ?? "USD").toLowerCase();
    if (!STRIPE_CURRENCIES.has(rawCurrency)) {
      throw new ConvexError(`Currency "${rawCurrency.toUpperCase()}" is not supported by Stripe.`);
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create({
        amount: args.amountCents,
        currency: rawCurrency,
        metadata: {
          type: "portal_case_fee",
          organisationId: args.organisationId,
          clientId: args.clientId,
          amountCents: String(args.amountCents),
          nextPaymentDate: args.nextPaymentDate ? String(args.nextPaymentDate) : "",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not connect to payment provider.";
      throw new ConvexError(`Payment initialisation failed: ${msg} Please try again in a moment.`);
    }

    return {
      clientSecret: intent.client_secret!,
      publishableKey: settings.stripePublishableKey,
      currency: (settings.defaultCurrency ?? "USD").toUpperCase(),
    };
  },
});

/**
 * Verify a completed Stripe PaymentIntent for a case fee payment and record it.
 * Called after stripe.confirmCardPayment succeeds on the portal payments page.
 * Reads clientId + nextPaymentDate from PI metadata — no paymentLinks lookup.
 * Idempotent via by_stripe_intent index.
 */
export const confirmCaseFeePayment = internalAction({
  args: {
    stripePaymentIntentId: v.string(),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args): Promise<void> => {
    const settings = await ctx.runQuery(internal.organisations.queries.getSettingsInternal, {
      organisationId: args.organisationId,
    });
    if (!settings?.stripeEnabled) return;
    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) return;

    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(args.stripePaymentIntentId);
    } catch {
      throw new ConvexError("Could not verify payment with Stripe.");
    }

    if (intent.status !== "succeeded") {
      throw new ConvexError(`Payment has not succeeded (status: ${intent.status}).`);
    }
    if (intent.metadata?.type !== "portal_case_fee" || intent.metadata?.organisationId !== args.organisationId) {
      throw new ConvexError("Payment intent does not belong to this organisation.");
    }

    const nextPaymentDate = intent.metadata.nextPaymentDate
      ? Number(intent.metadata.nextPaymentDate)
      : undefined;

    await ctx.runMutation(internal.billing.mutations.recordCaseFeePayment, {
      organisationId: args.organisationId,
      clientId: intent.metadata.clientId as Id<"clients">,
      amountCents: intent.amount,
      nextPaymentDate,
      stripePaymentIntentId: intent.id,
      currency: (settings.defaultCurrency ?? "USD").toUpperCase(),
    });
  },
});

/**
 * Create a Stripe PaymentIntent for a portal appointment booking.
 * Embeds appointment metadata in the PI so confirmAppointmentPayment can reconstruct it.
 * No payment link is created — the appointment is booked directly after payment succeeds.
 */
export const createAppointmentPaymentIntent = internalAction({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    amountCents: v.number(),
    appointmentType: v.string(),
    startAt: v.number(),
    caseId: v.optional(v.id("cases")),
    modality: v.optional(v.union(v.literal("online"), v.literal("offline"))),
    hostUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<{ clientSecret: string; publishableKey: string; amount: number; currency: string }> => {
    const settings = await ctx.runQuery(internal.organisations.queries.getSettingsInternal, {
      organisationId: args.organisationId,
    });
    if (!settings?.stripeEnabled || !settings.stripePublishableKey) {
      throw new ConvexError("Online card payments are not enabled for this organisation.");
    }
    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) {
      throw new ConvexError("Stripe is not configured for this organisation.");
    }
    const rawCurrency = (settings.defaultCurrency ?? "USD").toLowerCase();
    if (!STRIPE_CURRENCIES.has(rawCurrency)) {
      throw new ConvexError(`Currency "${rawCurrency.toUpperCase()}" is not supported by Stripe.`);
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create({
        amount: args.amountCents,
        currency: rawCurrency,
        capture_method: "manual", // authorise only — funds captured after case manager approves
        metadata: {
          type: "portal_appointment",
          organisationId: args.organisationId,
          clientId: args.clientId,
          appointmentType: args.appointmentType,
          startAt: String(args.startAt),
          durationMinutes: "60",
          caseId: args.caseId ?? "",
          modality: args.modality ?? "online",
          hostUserId: args.hostUserId ?? "",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not connect to payment provider.";
      throw new ConvexError(`Payment initialisation failed: ${msg}`);
    }

    return {
      clientSecret: intent.client_secret!,
      publishableKey: settings.stripePublishableKey,
      amount: args.amountCents,
      currency: (settings.defaultCurrency ?? "USD").toUpperCase(),
    };
  },
});

/**
 * Verify a completed Stripe PaymentIntent for an appointment booking and create the appointment.
 * Called after stripe.confirmCardPayment succeeds on the portal appointments page.
 * Reads all appointment metadata from the PI — no paymentLinks lookup needed.
 * If payment failed, records a Failed payment record only (no appointment created).
 * Idempotent via by_stripe_intent index.
 */
export const confirmAppointmentPayment = internalAction({
  args: {
    stripePaymentIntentId: v.string(),
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
  },
  handler: async (ctx, args): Promise<void> => {
    const settings = await ctx.runQuery(internal.organisations.queries.getSettingsInternal, {
      organisationId: args.organisationId,
    });
    if (!settings?.stripeEnabled) {
      throw new ConvexError("Stripe is not enabled for this organisation.");
    }
    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) {
      throw new ConvexError("Stripe is not configured for this organisation.");
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(args.stripePaymentIntentId);
    } catch {
      throw new ConvexError("Could not verify payment with Stripe.");
    }

    if (intent.metadata?.type !== "portal_appointment") {
      throw new ConvexError("Invalid payment intent type.");
    }
    if (intent.metadata?.organisationId !== args.organisationId) {
      throw new ConvexError("Payment intent does not belong to this organisation.");
    }
    if (intent.metadata?.clientId !== args.clientId) {
      throw new ConvexError("Payment intent does not belong to this client.");
    }

    const currency = (settings.defaultCurrency ?? "USD").toUpperCase();
    const startAt = Number(intent.metadata.startAt);
    const durationMinutes = Number(intent.metadata.durationMinutes);
    const caseId = (intent.metadata.caseId || undefined) as Id<"cases"> | undefined;
    const modality = (intent.metadata.modality ?? "online") as "online" | "offline";
    const hostUserId = (intent.metadata.hostUserId || undefined) as Id<"users"> | undefined;
    const appointmentType = intent.metadata.appointmentType;

    // requires_capture = card authorised, awaiting capture after approval (manual capture flow)
    let status: "Completed" | "On Hold" | "Failed";
    if (intent.status === "succeeded") status = "Completed";
    else if (intent.status === "requires_capture") status = "On Hold";
    else status = "Failed";

    await ctx.runMutation(internal.portal.mutations.recordDirectAppointmentPayment, {
      organisationId: args.organisationId,
      clientId: args.clientId,
      amountCents: intent.amount,
      currency,
      stripePaymentIntentId: intent.id,
      appointmentType,
      startAt,
      durationMinutes,
      caseId,
      modality,
      hostUserId,
      status,
    });

    if (status === "Failed") {
      throw new ConvexError("Payment authorisation failed. Please try again.");
    }
  },
});

/**
 * Capture a previously authorised (On Hold) Stripe PaymentIntent after appointment approval.
 * Called internally by approvePortalAppointment — never from the browser.
 * Fails silently on Stripe errors so the approval itself is not blocked.
 */
export const captureAppointmentPayment = internalAction({
  args: {
    paymentId: v.id("payments"),
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    appointmentId: v.id("appointments"),
    appointmentType: v.string(),
    startAt: v.number(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.runQuery(internal.portal.queries.getPaymentById, {
      paymentId: args.paymentId,
      organisationId: args.organisationId,
      clientId: args.clientId,
    });
    if (!payment || payment.status !== "On Hold" || !payment.stripePaymentIntentId) return;

    const settings = await ctx.runQuery(internal.portal.queries.getOrgStripeSettings, {
      organisationId: args.organisationId,
    });
    if (!settings?.stripeEnabled) return;
    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) return;

    try {
      const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
      await stripe.paymentIntents.capture(payment.stripePaymentIntentId);

      await ctx.runMutation(internal.billing.mutations.patchPaymentStatus, {
        paymentId: args.paymentId,
        status: "Completed",
      });

      // Notify client that their card has now been charged
      const dateStr = new Date(args.startAt).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      });
      await ctx.runMutation(internal.portal.mutations.insertPortalNotification, {
        organisationId: args.organisationId,
        clientId: args.clientId,
        type: "appointment_approved",
        title: "Payment charged",
        message: `Your card has been charged for the ${args.appointmentType} appointment on ${dateStr}.`,
        entityType: "appointment",
        entityId: args.appointmentId,
      });
    } catch (err) {
      console.error("captureAppointmentPayment failed:", err instanceof Error ? err.message : err);
    }
  },
});

/**
 * Cancel (void) a Stripe PaymentIntent that is awaiting capture after appointment rejection.
 * No money is taken from the client. Called internally by rejectPortalAppointment.
 * Fails silently on Stripe errors.
 */
export const voidAppointmentPayment = internalAction({
  args: {
    paymentId: v.id("payments"),
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    appointmentId: v.id("appointments"),
    appointmentType: v.string(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.runQuery(internal.portal.queries.getPaymentById, {
      paymentId: args.paymentId,
      organisationId: args.organisationId,
      clientId: args.clientId,
    });
    if (!payment || payment.status !== "On Hold" || !payment.stripePaymentIntentId) return;

    const settings = await ctx.runQuery(internal.portal.queries.getOrgStripeSettings, {
      organisationId: args.organisationId,
    });
    if (!settings?.stripeEnabled) return;
    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) return;

    try {
      const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
      await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);

      await ctx.runMutation(internal.billing.mutations.patchPaymentStatus, {
        paymentId: args.paymentId,
        status: "Voided",
      });

      await ctx.runMutation(internal.portal.mutations.insertPortalNotification, {
        organisationId: args.organisationId,
        clientId: args.clientId,
        type: "appointment_rejected",
        title: "Payment released — no charge made",
        message: `Your ${args.appointmentType} appointment was not confirmed. The authorisation hold on your card has been released and you have not been charged.`,
        entityType: "appointment",
        entityId: args.appointmentId,
      });
    } catch (err) {
      console.error("voidAppointmentPayment failed:", err instanceof Error ? err.message : err);
    }
  },
});

/**
 * Issue a Stripe refund for a cancelled portal appointment payment.
 * Called internally after cancelPortalAppointment — never directly from the browser.
 * Fails silently (logs + notifies client) rather than throwing, so the cancel itself isn't blocked.
 */
export const refundForPortalCancellation = internalAction({
  args: {
    paymentId: v.id("payments"),
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    appointmentId: v.id("appointments"),
    appointmentTitle: v.string(),
  },
  handler: async (ctx, args) => {
    // Load payment
    const payment = await ctx.runQuery(internal.portal.queries.getPaymentById, {
      paymentId: args.paymentId,
      organisationId: args.organisationId,
      clientId: args.clientId,
    });

    if (!payment || payment.status !== "Completed" || !payment.stripePaymentIntentId) {
      // Nothing to refund
      return;
    }

    // Load org Stripe settings
    const settings = await ctx.runQuery(internal.portal.queries.getOrgStripeSettings, {
      organisationId: args.organisationId,
    });

    if (!settings?.stripeEnabled) {
      await ctx.runMutation(internal.portal.mutations.insertPortalNotification, {
        organisationId: args.organisationId,
        clientId: args.clientId,
        type: "appointment_refund_pending",
        title: "Refund processing",
        message: `Your appointment "${args.appointmentTitle}" was cancelled. Please contact us to arrange your refund.`,
        entityType: "appointment",
        entityId: args.appointmentId,
      });
      return;
    }

    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) {
      await ctx.runMutation(internal.portal.mutations.insertPortalNotification, {
        organisationId: args.organisationId,
        clientId: args.clientId,
        type: "appointment_refund_pending",
        title: "Refund processing",
        message: `Your appointment "${args.appointmentTitle}" was cancelled. Please contact us to arrange your refund.`,
        entityType: "appointment",
        entityId: args.appointmentId,
      });
      return;
    }

    try {
      const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
      });

      // Mark payment as refunded
      await ctx.runMutation(internal.billing.mutations.patchPaymentStatus, {
        paymentId: args.paymentId,
        status: "Refunded",
        stripeRefundId: refund.id,
      });

      await ctx.runMutation(internal.portal.mutations.insertPortalNotification, {
        organisationId: args.organisationId,
        clientId: args.clientId,
        type: "appointment_refunded",
        title: "Refund initiated",
        message: `A refund of ${(payment.amount / 100).toFixed(2)} ${payment.currency.toUpperCase()} for "${args.appointmentTitle}" has been initiated. It may take 5–10 business days to appear.`,
        entityType: "appointment",
        entityId: args.appointmentId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Portal refund failed:", msg);

      await ctx.runMutation(internal.portal.mutations.insertPortalNotification, {
        organisationId: args.organisationId,
        clientId: args.clientId,
        type: "appointment_refund_pending",
        title: "Refund processing",
        message: `Your appointment "${args.appointmentTitle}" was cancelled. Please contact us to arrange your refund.`,
        entityType: "appointment",
        entityId: args.appointmentId,
      });
    }
  },
});

// ─── Prospect payment actions ─────────────────────────────────────────────────

/**
 * Create (or retrieve existing) a Stripe PaymentIntent for a prospect's appointment.
 * Called from the public /portal/[orgSlug]/pay/[requestId] page.
 * Idempotent — returns the existing PI if already created.
 */
export const initProspectPayment = internalAction({
  args: {
    organisationId: v.id("organisations"),
    requestId: v.id("appointmentRequests"),
  },
  handler: async (ctx, args): Promise<{
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
    appointmentType: string;
    preferredDate: string;
    preferredTime: string;
    orgName: string;
  }> => {
    const req = await ctx.runQuery(internal.appointmentRequests.queries.getById, {
      id: args.requestId,
    });
    if (!req || req.organisationId !== args.organisationId) {
      throw new ConvexError("Request not found.");
    }
    if (req.status !== "awaiting_payment") {
      throw new ConvexError("This request is not awaiting payment.");
    }
    if (req.paymentDeadline && Date.now() > req.paymentDeadline) {
      throw new ConvexError("Payment window has expired.");
    }

    const settings = await ctx.runQuery(internal.organisations.queries.getSettingsInternal, {
      organisationId: args.organisationId,
    });
    if (!settings?.stripeEnabled || !settings.stripePublishableKey) {
      throw new ConvexError("Online payments are not enabled for this organisation.");
    }
    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) throw new ConvexError("Stripe is not configured.");

    const org = await ctx.runQuery(internal.organisations.queries.getById, {
      id: args.organisationId,
    });

    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });

    // Idempotent — reuse existing PaymentIntent if already created
    if (req.paymentIntentId) {
      let existing: Stripe.PaymentIntent;
      try {
        existing = await stripe.paymentIntents.retrieve(req.paymentIntentId);
      } catch {
        throw new ConvexError("Could not retrieve payment session.");
      }
      if (existing.status === "succeeded") throw new ConvexError("Payment already completed.");
      return {
        clientSecret: existing.client_secret!,
        publishableKey: settings.stripePublishableKey,
        amountCents: req.paymentAmountCents!,
        currency: req.paymentCurrency!,
        appointmentType: req.appointmentType,
        preferredDate: req.preferredDate,
        preferredTime: req.preferredTime,
        orgName: org?.name ?? "the organisation",
      };
    }

    const rawCurrency = (settings.defaultCurrency ?? "USD").toLowerCase();
    const amountCents = req.paymentAmountCents!;

    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: rawCurrency,
        metadata: {
          type: "prospect_appointment",
          organisationId: String(args.organisationId),
          requestId: String(args.requestId),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment provider error.";
      throw new ConvexError(`Payment initialisation failed: ${msg}`);
    }

    // Store PI id on the request record
    await ctx.runMutation(internal.appointmentRequests.mutations.setPaymentIntent, {
      requestId: args.requestId,
      paymentIntentId: intent.id,
    });

    return {
      clientSecret: intent.client_secret!,
      publishableKey: settings.stripePublishableKey,
      amountCents,
      currency: (settings.defaultCurrency ?? "USD").toUpperCase(),
      appointmentType: req.appointmentType,
      preferredDate: req.preferredDate,
      preferredTime: req.preferredTime,
      orgName: org?.name ?? "the organisation",
    };
  },
});

/**
 * Verify a Stripe PaymentIntent after the prospect confirms payment on the payment page.
 * Marks the request as "paid" and the appointment as "Upcoming".
 */
export const completeProspectPayment = internalAction({
  args: {
    organisationId: v.id("organisations"),
    requestId: v.id("appointmentRequests"),
    paymentIntentId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const req = await ctx.runQuery(internal.appointmentRequests.queries.getById, {
      id: args.requestId,
    });
    if (!req || req.organisationId !== args.organisationId) {
      throw new ConvexError("Request not found.");
    }
    if (req.status === "paid") return; // idempotent

    const settings = await ctx.runQuery(internal.organisations.queries.getSettingsInternal, {
      organisationId: args.organisationId,
    });
    const secretKey = settings ? await resolveSecretKey(settings) : null;
    if (!secretKey) throw new ConvexError("Stripe not configured.");

    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(args.paymentIntentId);
    } catch {
      throw new ConvexError("Could not verify payment.");
    }

    if (
      intent.metadata?.type !== "prospect_appointment" ||
      intent.metadata?.requestId !== args.requestId ||
      intent.metadata?.organisationId !== args.organisationId
    ) {
      throw new ConvexError("Payment intent does not match this request.");
    }
    if (intent.status !== "succeeded") {
      throw new ConvexError(`Payment has not succeeded (status: ${intent.status}).`);
    }

    await ctx.runMutation(internal.appointmentRequests.mutations.markPaid, {
      requestId: args.requestId,
      paymentIntentId: args.paymentIntentId,
    });

    // Record in the payments table so it appears in /payments → Stripe tab
    const currency = (settings?.defaultCurrency ?? "USD").toUpperCase();
    await ctx.runMutation(internal.billing.mutations.recordProspectPayment, {
      organisationId: args.organisationId,
      requestId: args.requestId,
      appointmentId: req.convertedAppointmentId,
      amountCents: req.paymentAmountCents!,
      currency,
      stripePaymentIntentId: args.paymentIntentId,
      prospectName: `${req.firstName} ${req.lastName}`,
      appointmentType: req.appointmentType,
    });

    // Schedule Google Meet creation for the confirmed appointment (online, paid path)
    if (req.convertedAppointmentId && req.reviewedBy) {
      await ctx.runAction(internal.googleCalendar.actions.createEvent, {
        appointmentId: req.convertedAppointmentId,
        creatorUserId: req.reviewedBy,
      });
    }
  },
});
