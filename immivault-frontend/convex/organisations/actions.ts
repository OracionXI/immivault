import { action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { encryptSecret } from "../lib/crypto";

/**
 * Saves Stripe gateway settings for the caller's organisation. Admin only.
 *
 * As an action, this can access process.env to read STRIPE_MASTER_KEY
 * and encrypt the secret key + webhook secret before storing them in the DB.
 * If STRIPE_MASTER_KEY is not set, falls back to storing plaintext.
 */
export const saveStripeSettings = action({
  args: {
    stripeEnabled: v.boolean(),
    stripePublishableKey: v.string(),
    stripeSecretKey: v.string(),
    stripeWebhookSecret: v.string(),
  },
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
    if (user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }

    // ── Validate key formats only when non-empty ──────────────────────────
    const pk = args.stripePublishableKey.trim();
    const sk = args.stripeSecretKey.trim();
    const wh = args.stripeWebhookSecret.trim();

    if (pk && !/^pk_(test|live)_/.test(pk)) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Stripe publishable key must start with pk_live_ or pk_test_.",
      });
    }
    if (sk && !sk.startsWith("sk_")) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Stripe secret key must start with sk_live_ or sk_test_.",
      });
    }
    if (wh && !wh.startsWith("whsec_")) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Stripe webhook secret must start with whsec_.",
      });
    }

    // ── Encrypt secrets — STRIPE_MASTER_KEY is required ─────────────────
    // Empty strings mean "keep existing key" — don't overwrite with empty.
    const masterKey = process.env.STRIPE_MASTER_KEY;

    if ((sk || wh) && !masterKey) {
      throw new ConvexError({
        code: "CONFIGURATION_ERROR",
        message:
          "STRIPE_MASTER_KEY is not configured on this server. Cannot store Stripe credentials securely. Please contact your administrator.",
      });
    }

    let stripeSecretKeyEnc: string | undefined;
    let stripeWebhookSecretEnc: string | undefined;

    if (masterKey) {
      // Only encrypt + store if a new value was provided
      if (sk) stripeSecretKeyEnc = await encryptSecret(sk, masterKey);
      if (wh) stripeWebhookSecretEnc = await encryptSecret(wh, masterKey);
    }

    await ctx.runMutation(internal.organisations.mutations.updateStripeSettingsInternal, {
      organisationId: user.organisationId,
      stripeEnabled: args.stripeEnabled,
      stripePublishableKey: args.stripePublishableKey.trim() || undefined,
      stripeSecretKeyEnc,
      stripeWebhookSecretEnc,
    });
  },
});
