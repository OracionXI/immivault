import { mutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { checkRateLimit } from "../lib/rateLimit";
import { requireAdmin } from "../lib/rbac";

const invoiceStatusValidator = v.union(
  v.literal("Draft"),
  v.literal("Sent"),
  v.literal("Paid"),
  v.literal("Overdue")
);

const itemValidator = v.object({
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
});

/** Creates an invoice with its line items in one transaction. */
export const createInvoice = authenticatedMutation({
  args: {
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    status: invoiceStatusValidator,
    taxRate: v.number(),
    dueDate: v.number(),
    notes: v.optional(v.string()),
    items: v.array(itemValidator),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const { items, taxRate, ...rest } = args;

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Generate invoice number
    const count = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .collect();
    const invoiceNumber = `INV-${String(count.length + 1).padStart(4, "0")}`;

    const invoiceId = await ctx.db.insert("invoices", {
      ...rest,
      taxRate,
      subtotal,
      taxAmount,
      total,
      invoiceNumber,
      organisationId: ctx.user.organisationId,
      createdBy: ctx.user._id,
    });

    for (const item of items) {
      await ctx.db.insert("invoiceItems", {
        invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
      });
    }

    return invoiceId;
  },
});

/** Updates invoice header fields (not line items). */
export const updateInvoice = authenticatedMutation({
  args: {
    id: v.id("invoices"),
    status: v.optional(invoiceStatusValidator),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    issuedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const { id, ...fields } = args;
    const invoice = await ctx.db.get(id);
    if (!invoice || invoice.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found." });
    }
    await ctx.db.patch(id, fields);
  },
});

/** Deletes an invoice and all its line items. */
export const removeInvoice = authenticatedMutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const invoice = await ctx.db.get(args.id);
    if (!invoice || invoice.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found." });
    }
    const items = await ctx.db
      .query("invoiceItems")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(args.id);
  },
});

/** Records a payment and marks the invoice as Paid if fully covered. */
export const recordPayment = authenticatedMutation({
  args: {
    invoiceId: v.id("invoices"),
    clientId: v.id("clients"),
    amount: v.number(),
    currency: v.string(),
    method: v.union(
      v.literal("Card"),
      v.literal("Bank Transfer"),
      v.literal("Cash"),
      v.literal("Check"),
      v.literal("Online")
    ),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    paidAt: v.number(),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found." });
    }

    const paymentId = await ctx.db.insert("payments", {
      ...args,
      organisationId: ctx.user.organisationId,
      status: "Completed",
    });

    // Auto-mark invoice as Paid if payment covers the total
    if (args.amount >= invoice.total) {
      await ctx.db.patch(args.invoiceId, { status: "Paid", paidAt: args.paidAt });
    }

    return paymentId;
  },
});

/**
 * Public mutation — no auth required.
 * Validates the payment link token, records a payment, marks the link as
 * Used, and marks the associated invoice as Paid (if one exists).
 */
export const processPaymentLink = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("paymentLinks")
      .withIndex("by_token", (q) => q.eq("urlToken", args.token))
      .unique();

    if (!link) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payment link not found." });
    }
    if (link.status !== "Active") {
      throw new ConvexError({ code: "INVALID", message: "This payment link is no longer active." });
    }
    if (link.expiresAt < Date.now()) {
      throw new ConvexError({ code: "EXPIRED", message: "This payment link has expired." });
    }

    const now = Date.now();

    await ctx.db.insert("payments", {
      organisationId: link.organisationId,
      invoiceId: link.invoiceId,
      clientId: link.clientId,
      amount: link.amount,
      currency: "USD",
      method: "Online",
      status: "Completed",
      paidAt: now,
    });

    await ctx.db.patch(link._id, { status: "Used" });

    if (link.invoiceId) {
      await ctx.db.patch(link.invoiceId, { status: "Paid", paidAt: now });
    }
  },
});

/** Creates a shareable payment link for an invoice or standalone. */
export const createPaymentLink = authenticatedMutation({
  args: {
    invoiceId: v.optional(v.id("invoices")),
    clientId: v.id("clients"),
    amount: v.number(),
    description: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    // Rate limit: max 20 payment links per hour per org
    await checkRateLimit(ctx, `createPaymentLink:${ctx.user.organisationId}`, 20, 3_600_000);

    // Generate a short unique token
    const urlToken =
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 10);

    return await ctx.db.insert("paymentLinks", {
      ...args,
      urlToken,
      status: "Active",
      organisationId: ctx.user.organisationId,
      createdBy: ctx.user._id,
    });
  },
});
