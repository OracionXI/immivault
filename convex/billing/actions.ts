import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import Stripe from "stripe";
import { ConvexError } from "convex/values";

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

    // Full Amount validation: link amount must match client contract amount
    if (link.paymentType === "Full Amount") {
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
    if (!settings?.stripeEnabled || !settings.stripeSecretKey || !settings.stripePublishableKey) {
      throw new Error("Online card payments are not enabled for this organisation.");
    }

    const stripe = new Stripe(settings.stripeSecretKey, { apiVersion: "2026-02-25.clover" });

    const currency = (settings.defaultCurrency ?? "USD").toLowerCase();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: link.amount,           // already in cents
      currency,
      metadata: {
        token: args.token,
        organisationId: link.organisationId,
        clientId: link.clientId,
        ...(link.invoiceId ? { invoiceId: link.invoiceId } : {}),
      },
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      publishableKey: settings.stripePublishableKey,
      amount: link.amount,
      currency: (settings.defaultCurrency ?? "USD"),
      organisationId: link.organisationId,
    };
  },
});

/**
 * Internal action — called by the Stripe webhook handler.
 * Verifies the signature and processes payment_intent.succeeded.
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
    if (!settings?.stripeWebhookSecret) {
      throw new Error("Webhook secret not configured for this organisation.");
    }

    const stripe = new Stripe(settings.stripeSecretKey!, { apiVersion: "2026-02-25.clover" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        args.payload,
        args.signature,
        settings.stripeWebhookSecret
      );
    } catch {
      throw new Error("Invalid webhook signature.");
    }

    if (event.type === "payment_intent.succeeded") {
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
    }
  },
});
