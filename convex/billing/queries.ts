import { query, internalQuery } from "../_generated/server";
import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/** All invoices in the org. */
export const listInvoices = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .order("desc")
      .collect();
  },
});

/** Single invoice with its line items joined. */
export const getInvoice = authenticatedQuery({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.id);
    if (!invoice || invoice.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found." });
    }
    const items = await ctx.db
      .query("invoiceItems")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
      .collect();
    return { ...invoice, items };
  },
});

/** All payments in the org. */
export const listPayments = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .order("desc")
      .collect();
  },
});

/**
 * Public query — no auth required.
 * Looks up a payment link by its URL token and returns the link with
 * client name and optional invoice number for display on the pay page.
 */
export const getPaymentLinkByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("paymentLinks")
      .withIndex("by_token", (q) => q.eq("urlToken", args.token))
      .unique();

    if (!link) return null;

    const client = await ctx.db.get(link.clientId);
    const invoice = link.invoiceId ? await ctx.db.get(link.invoiceId) : null;

    return {
      ...link,
      clientName: client ? `${client.firstName} ${client.lastName}` : "Unknown",
      invoiceNumber: invoice?.invoiceNumber ?? null,
    };
  },
});

/**
 * Internal query — used by the createPaymentIntent action.
 * Returns the raw payment link document including organisationId.
 */
export const getPaymentLinkForAction = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("paymentLinks")
      .withIndex("by_token", (q) => q.eq("urlToken", args.token))
      .unique();
  },
});

/** All payment links in the org. */
export const listPaymentLinks = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("paymentLinks")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .order("desc")
      .collect();
  },
});
