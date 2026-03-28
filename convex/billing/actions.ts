import { action, internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import Stripe from "stripe";
import { ConvexError } from "convex/values";
import { decryptSecret, isEncrypted } from "../lib/crypto";

// ── Stripe-supported currency codes ───────────────────────────────────────────
// Subset covering the most commonly used currencies. Stripe rejects unknown codes.
const STRIPE_CURRENCIES = new Set([
  "usd","eur","gbp","aud","cad","nzd","chf","sek","nok","dkk","jpy","cny",
  "hkd","sgd","myr","idr","thb","php","inr","pkr","bdt","lkr","ngn","kes",
  "ghs","zar","aed","sar","qar","kwd","bhd","omr","jod","egp","mad","dzd",
  "tnd","tzs","ugx","rwf","xof","xaf","brl","mxn","ars","clp","cop","pen",
  "uyu","bob","pyg","gtq","hnl","nio","dop","jmd","ttd","bbd","bmd","bsd",
  "kyd","xcd","awg","ang","crc","pab","gyd","srd","czk","pln","huf","ron",
  "bgn","hrk","rsd","try","ils","isk","mkd","mdl","gel","amd","azn","kzt",
  "uzs","kgs","tjs","mnt","mmk","khr","vnd","lak","bnd","pgk","fjd","wst",
  "top","vuv","sbd",
]);

/**
 * Helper: resolve the decrypted Stripe secret key from org settings.
 * Prefers the AES-encrypted field; falls back to legacy plaintext.
 */
async function resolveSecretKey(
  settings: { stripeSecretKey?: string; stripeSecretKeyEnc?: string }
): Promise<string | null> {
  if (settings.stripeSecretKeyEnc) {
    const masterKey = process.env.STRIPE_MASTER_KEY;
    if (!masterKey) {
      // Master key not configured — encrypted value can't be decrypted
      throw new ConvexError(
        "STRIPE_MASTER_KEY environment variable is not set. Cannot decrypt Stripe credentials."
      );
    }
    return decryptSecret(settings.stripeSecretKeyEnc, masterKey);
  }
  return settings.stripeSecretKey ?? null;
}

/**
 * Helper: resolve the decrypted Stripe webhook secret from org settings.
 */
async function resolveWebhookSecret(
  settings: { stripeWebhookSecret?: string; stripeWebhookSecretEnc?: string }
): Promise<string | null> {
  if (settings.stripeWebhookSecretEnc) {
    const masterKey = process.env.STRIPE_MASTER_KEY;
    if (!masterKey) {
      throw new ConvexError(
        "STRIPE_MASTER_KEY environment variable is not set. Cannot decrypt Stripe credentials."
      );
    }
    return decryptSecret(settings.stripeWebhookSecretEnc, masterKey);
  }
  return settings.stripeWebhookSecret ?? null;
}

// ── Log helper ────────────────────────────────────────────────────────────────

async function logWebhookEvent(
  ctx: Pick<ActionCtx, "runMutation">,
  organisationId: string,
  stripeEventId: string,
  eventType: string,
  status: "processed" | "skipped" | "failed",
  error?: string
) {
  try {
    await ctx.runMutation(internal.billing.mutations.insertWebhookLog, {
      organisationId: organisationId as any,
      stripeEventId,
      eventType,
      status,
      error,
    });
  } catch {
    // Log failures must never crash the webhook handler
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ACTION: createPaymentIntent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public action — no auth required.
 * Creates a Stripe PaymentIntent using the organisation's Stripe secret key
 * and returns the clientSecret + publishableKey to the frontend.
 */
export const createPaymentIntent = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{
    clientSecret: string;
    publishableKey: string;
    amount: number;
    currency: string;
    organisationId: string;
  }> => {
    // Fetch the payment link (public query — no auth)
    const link = await ctx.runQuery(
      internal.billing.queries.getPaymentLinkForAction,
      { token: args.token }
    );
    if (!link) throw new ConvexError("Payment link not found.");
    if (link.status !== "Active") throw new ConvexError("This payment link is no longer active.");
    if (link.expiresAt < Date.now()) throw new ConvexError("This payment link has expired.");

    // Full Amount validation: link amount must match client contract amount.
    // Appointment payment links are exempt — their amount is the appointment fee, not a contract payment.
    if (link.paymentType === "Full Amount" && !link.appointmentPricingId) {
      const client = await ctx.runQuery(internal.clients.queries.getForAction, { id: link.clientId });
      if (client?.contractAmount && link.amount !== client.contractAmount) {
        throw new ConvexError(
          `Payment amount ($${(link.amount / 100).toFixed(2)}) does not match the contract amount ($${(client.contractAmount / 100).toFixed(2)}). Please contact the firm.`
        );
      }
    }

    // Get org Stripe settings
    const settings = await ctx.runQuery(internal.organisations.queries.getSettingsInternal, {
      organisationId: link.organisationId,
    });
    if (!settings?.stripeEnabled || !settings.stripePublishableKey) {
      throw new ConvexError("Online card payments are not enabled for this organisation.");
    }

    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) {
      throw new ConvexError("Online card payments are not enabled for this organisation.");
    }

    // Validate currency
    const rawCurrency = (settings.defaultCurrency ?? "USD").toLowerCase();
    if (!STRIPE_CURRENCIES.has(rawCurrency)) {
      throw new ConvexError(
        `Currency "${rawCurrency.toUpperCase()}" is not supported by Stripe. Please update your currency settings.`
      );
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });

    let paymentIntent: Stripe.PaymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: link.amount,           // already in cents
        currency: rawCurrency,
        metadata: {
          token: args.token,
          organisationId: link.organisationId,
          clientId: link.clientId,
          ...(link.invoiceId ? { invoiceId: link.invoiceId } : {}),
          // Tax info for Stripe records (informational — tax is already included in amount)
          ...(settings.taxRate ? { taxRate: String(settings.taxRate) } : {}),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not connect to payment provider.";
      throw new ConvexError(`Payment initialisation failed: ${msg} Please try again in a moment.`);
    }

    return {
      clientSecret: paymentIntent.client_secret!,
      publishableKey: settings.stripePublishableKey,
      amount: link.amount,
      currency: settings.defaultCurrency ?? "USD",
      organisationId: link.organisationId,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL ACTION: handleWebhookEvent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal action — called by the Stripe webhook HTTP handler.
 * Verifies signature and dispatches all supported Stripe events.
 */
export const handleWebhookEvent = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.runQuery(internal.organisations.queries.getSettingsInternal, {
      organisationId: args.organisationId,
    });
    if (!settings) {
      throw new Error("Organisation settings not found.");
    }

    const webhookSecret = await resolveWebhookSecret(settings);
    if (!webhookSecret) {
      throw new Error("Webhook secret not configured for this organisation.");
    }

    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) {
      throw new Error("Stripe secret key not configured for this organisation.");
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        args.payload,
        args.signature,
        webhookSecret
      );
    } catch {
      throw new Error("Invalid webhook signature.");
    }

    const { type, id: stripeEventId } = event;

    // ── Idempotency: skip already-processed events ─────────────────────────
    const alreadyLogged = await ctx.runQuery(internal.billing.queries.getWebhookLog, {
      stripeEventId,
    });
    if (alreadyLogged?.status === "processed") {
      await logWebhookEvent(ctx, args.organisationId, stripeEventId, type, "skipped");
      return;
    }

    try {
      // ── payment_intent.succeeded ────────────────────────────────────────
      if (type === "payment_intent.succeeded") {
        const intent = event.data.object as Stripe.PaymentIntent;
        const token = intent.metadata?.token;
        if (token) {
          await ctx.runMutation(internal.billing.mutations.processStripeWebhookPayment, {
            token,
            stripePaymentIntentId: intent.id,
            amount: intent.amount,
            organisationId: args.organisationId,
          });
        }
        await logWebhookEvent(ctx, args.organisationId, stripeEventId, type, "processed");
        return;
      }

      // ── charge.refunded ─────────────────────────────────────────────────
      if (type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : null;
        if (paymentIntentId) {
          await ctx.runMutation(internal.billing.mutations.markPaymentRefundedByIntentId, {
            stripePaymentIntentId: paymentIntentId,
            organisationId: args.organisationId,
          });
        }
        await logWebhookEvent(ctx, args.organisationId, stripeEventId, type, "processed");
        return;
      }

      // ── charge.dispute.created ──────────────────────────────────────────
      if (type === "charge.dispute.created") {
        const dispute = event.data.object as Stripe.Dispute;
        const piId = typeof dispute.payment_intent === "string"
          ? dispute.payment_intent
          : undefined;
        await ctx.runMutation(internal.billing.mutations.createDispute, {
          organisationId: args.organisationId,
          stripeDisputeId: dispute.id,
          stripePaymentIntentId: piId,
          amount: dispute.amount,
          currency: dispute.currency,
          reason: dispute.reason,
          status: dispute.status as any,
          dueBy: dispute.evidence_details?.due_by
            ? dispute.evidence_details.due_by * 1000
            : undefined,
        });
        await logWebhookEvent(ctx, args.organisationId, stripeEventId, type, "processed");
        return;
      }

      // ── charge.dispute.updated / charge.dispute.closed ──────────────────
      if (type === "charge.dispute.updated" || type === "charge.dispute.closed") {
        const dispute = event.data.object as Stripe.Dispute;
        await ctx.runMutation(internal.billing.mutations.updateDisputeStatus, {
          stripeDisputeId: dispute.id,
          organisationId: args.organisationId,
          status: dispute.status as any,
        });
        await logWebhookEvent(ctx, args.organisationId, stripeEventId, type, "processed");
        return;
      }

      // Unknown/unhandled event — log as skipped
      await logWebhookEvent(ctx, args.organisationId, stripeEventId, type, "skipped");

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await logWebhookEvent(ctx, args.organisationId, stripeEventId, type, "failed", errorMsg);
      throw err; // Re-throw so the HTTP handler returns 500 for retry
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ACTION: confirmStripePayment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public action — called by the frontend after stripe.confirmCardPayment resolves.
 * Verifies the PaymentIntent status and amount against Stripe's API before
 * recording the payment. This prevents clients from marking invoices as paid
 * without an actual successful charge.
 */
export const confirmStripePayment = action({
  args: {
    token: v.string(),
    stripePaymentIntentId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Rate limit: max 5 attempts per token per hour
    await ctx.runMutation(internal.billing.mutations.checkRateLimitPublic, {
      key: `confirmStripePayment:${args.token}`,
      maxRequests: 5,
      windowMs: 3_600_000,
    });

    // Load the payment link
    const link = await ctx.runQuery(
      internal.billing.queries.getPaymentLinkForAction,
      { token: args.token }
    );
    if (!link) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payment link not found." });
    }
    if (link.status === "Used") return; // idempotent — webhook may have already run

    // Get org Stripe settings
    const settings = await ctx.runQuery(
      internal.organisations.queries.getSettingsInternal,
      { organisationId: link.organisationId }
    );
    if (!settings?.stripeEnabled) {
      throw new ConvexError({ code: "INVALID", message: "Stripe is not enabled for this organisation." });
    }

    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) {
      throw new ConvexError({ code: "INVALID", message: "Stripe secret key not configured." });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });

    // ── Server-side verification: retrieve PaymentIntent from Stripe ──────
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(args.stripePaymentIntentId);
    } catch {
      throw new ConvexError({ code: "STRIPE_ERROR", message: "Could not verify payment with Stripe." });
    }

    if (intent.status !== "succeeded") {
      throw new ConvexError({
        code: "PAYMENT_NOT_COMPLETE",
        message: `Payment has not succeeded (status: ${intent.status}). Please try again.`,
      });
    }

    // Verify the PaymentIntent belongs to this payment link
    if (intent.metadata?.token !== args.token) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Payment intent does not match this payment link." });
    }

    // Verify the charged amount matches the link amount (prevents amount manipulation)
    if (intent.amount !== link.amount) {
      throw new ConvexError({
        code: "AMOUNT_MISMATCH",
        message: "Payment amount does not match the expected amount.",
      });
    }

    // Delegate the DB write to the existing hardened internal mutation
    await ctx.runMutation(internal.billing.mutations.processStripeWebhookPayment, {
      token: args.token,
      stripePaymentIntentId: intent.id,
      amount: intent.amount,
      organisationId: link.organisationId,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ACTION: refundPayment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authenticated action — admin or accountant only.
 * Issues a full refund via Stripe and marks the payment as Refunded in the DB.
 */
export const refundPayment = action({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args) => {
    // ── Auth ────────────────────────────────────────────────────────────────
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated." });
    }
    const user = await ctx.runQuery(internal.users.queries.getByToken, {
      token: identity.tokenIdentifier,
    });
    if (!user || user.status !== "active") {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found." });
    }
    if (user.role !== "admin" && user.role !== "accountant") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin or accountant privileges required." });
    }

    // ── Load payment ────────────────────────────────────────────────────────
    const payment = await ctx.runQuery(internal.billing.queries.getPaymentInternal, {
      id: args.paymentId,
    });
    if (!payment || payment.organisationId !== user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payment not found." });
    }
    if (payment.status === "Refunded") {
      throw new ConvexError({ code: "INVALID", message: "This payment has already been refunded." });
    }
    if (!payment.stripePaymentIntentId) {
      throw new ConvexError({
        code: "INVALID",
        message:
          "Only card payments processed via Stripe can be refunded automatically. For other payment methods, process the refund manually and update the payment status.",
      });
    }

    // ── Get org Stripe settings ─────────────────────────────────────────────
    const settings = await ctx.runQuery(internal.organisations.queries.getSettingsInternal, {
      organisationId: user.organisationId,
    });
    if (!settings?.stripeEnabled) {
      throw new ConvexError({ code: "INVALID", message: "Stripe is not enabled for this organisation." });
    }

    const secretKey = await resolveSecretKey(settings);
    if (!secretKey) {
      throw new ConvexError({ code: "INVALID", message: "Stripe secret key not configured." });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });

    // ── Create Stripe refund ─────────────────────────────────────────────────
    let refund: Stripe.Refund;
    try {
      refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        metadata: {
          refundedBy: user._id,
          organisationId: user.organisationId,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Stripe refund failed.";
      throw new ConvexError({ code: "STRIPE_ERROR", message: msg });
    }

    if (refund.status === "failed" || refund.status === "canceled") {
      throw new ConvexError({
        code: "STRIPE_ERROR",
        message: `Refund was ${refund.status}. Please check your Stripe dashboard.`,
      });
    }

    // ── Mark payment as Refunded in DB ───────────────────────────────────────
    await ctx.runMutation(internal.billing.mutations.markPaymentRefunded, {
      paymentId: args.paymentId,
      stripeRefundId: refund.id,
    });
  },
});
