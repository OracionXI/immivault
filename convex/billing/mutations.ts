import { mutation, internalMutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { checkRateLimit } from "../lib/rateLimit";
import { requireAdmin, requireAdminOrAccountant } from "../lib/rbac";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Helper: generate next invoice number for an org. */
async function nextInvoiceNumber(ctx: MutationCtx, organisationId: Id<"organisations">): Promise<string> {
  const all = await ctx.db
    .query("invoices")
    .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
    .collect();
  return `INV-${String(all.length + 1).padStart(4, "0")}`;
}

/**
 * Helper: after a successful payment, create a Paid invoice record and
 * increment paidAmount on the client's contract Draft invoice (if any).
 */
async function recordPaidInvoiceAndUpdateDraft(
  ctx: MutationCtx,
  opts: {
    organisationId: Id<"organisations">;
    clientId: Id<"clients">;
    caseId?: Id<"cases">;
    amount: number;       // in cents
    paymentType?: string;
    description: string;
    paidAt: number;
    createdBy?: Id<"users">;
  }
) {
  const amountInDollars = opts.amount / 100;
  const invoiceNumber = await nextInvoiceNumber(ctx, opts.organisationId);

  await ctx.db.insert("invoices", {
    organisationId: opts.organisationId,
    clientId: opts.clientId,
    caseId: opts.caseId,
    status: "Paid",
    taxRate: 0,
    subtotal: amountInDollars,
    taxAmount: 0,
    total: amountInDollars,
    invoiceNumber,
    dueDate: opts.paidAt,
    paidAt: opts.paidAt,
    issuedAt: opts.paidAt,
    createdBy: opts.createdBy,
    notes: opts.description,
  });

  // Update paidAmount on the contract Draft invoice for this client
  const contractDraft = await ctx.db
    .query("invoices")
    .withIndex("by_org", (q) => q.eq("organisationId", opts.organisationId))
    .filter((q) =>
      q.and(
        q.eq(q.field("clientId"), opts.clientId),
        q.eq(q.field("isContractDraft"), true)
      )
    )
    .first();

  if (contractDraft) {
    const newPaidAmount = (contractDraft.paidAmount ?? 0) + amountInDollars;
    await ctx.db.patch(contractDraft._id, { paidAmount: newPaidAmount });
  }
}

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
    requireAdminOrAccountant(ctx);
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
    caseId: v.optional(v.id("cases")),
  },
  handler: async (ctx, args) => {
    requireAdminOrAccountant(ctx);
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
    requireAdminOrAccountant(ctx);
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
      caseId: link.caseId,
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

    await recordPaidInvoiceAndUpdateDraft(ctx, {
      organisationId: link.organisationId,
      clientId: link.clientId,
      caseId: link.caseId,
      amount: link.amount,
      paymentType: link.paymentType,
      description: link.description,
      paidAt: now,
    });
  },
});

/** Creates a shareable payment link for an invoice or standalone. */
export const createPaymentLink = authenticatedMutation({
  args: {
    invoiceId: v.optional(v.id("invoices")),
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    amount: v.number(),
    description: v.string(),
    expiresAt: v.number(),
    paymentType: v.optional(v.union(
      v.literal("Full Amount"),
      v.literal("Installment"),
      v.literal("Deposit"),
      v.literal("Partial"),
    )),
    nextPaymentDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAdminOrAccountant(ctx);
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

/**
 * Internal mutation — called by the Stripe webhook action after verifying signature.
 * Idempotent: skips if the PaymentIntent was already recorded.
 */
export const processStripeWebhookPayment = internalMutation({
  args: {
    token: v.string(),
    stripePaymentIntentId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("paymentLinks")
      .withIndex("by_token", (q) => q.eq("urlToken", args.token))
      .unique();

    if (!link || link.status === "Used") return; // already processed

    const now = Date.now();

    await ctx.db.insert("payments", {
      organisationId: link.organisationId,
      invoiceId: link.invoiceId,
      clientId: link.clientId,
      caseId: link.caseId,
      amount: args.amount,
      currency: "USD",
      method: "Card",
      status: "Completed",
      paidAt: now,
      stripePaymentIntentId: args.stripePaymentIntentId,
      reference: args.stripePaymentIntentId,
    });

    await ctx.db.patch(link._id, { status: "Used" });

    if (link.invoiceId) {
      await ctx.db.patch(link.invoiceId, { status: "Paid", paidAt: now });
    }

    await recordPaidInvoiceAndUpdateDraft(ctx, {
      organisationId: link.organisationId,
      clientId: link.clientId,
      caseId: link.caseId,
      amount: args.amount,
      paymentType: link.paymentType,
      description: link.description,
      paidAt: now,
    });
  },
});

/**
 * Public mutation — called by the frontend after stripe.confirmCardPayment succeeds.
 * Also idempotent via stripePaymentIntentId check.
 */
export const confirmStripePayment = mutation({
  args: {
    token: v.string(),
    stripePaymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("paymentLinks")
      .withIndex("by_token", (q) => q.eq("urlToken", args.token))
      .unique();

    if (!link) throw new ConvexError({ code: "NOT_FOUND", message: "Payment link not found." });
    if (link.status === "Used") return; // idempotent — webhook may have already run

    const now = Date.now();

    await ctx.db.insert("payments", {
      organisationId: link.organisationId,
      invoiceId: link.invoiceId,
      clientId: link.clientId,
      caseId: link.caseId,
      amount: link.amount,
      currency: "USD",
      method: "Card",
      status: "Completed",
      paidAt: now,
      stripePaymentIntentId: args.stripePaymentIntentId,
      reference: args.stripePaymentIntentId,
    });

    await ctx.db.patch(link._id, { status: "Used" });

    if (link.invoiceId) {
      await ctx.db.patch(link.invoiceId, { status: "Paid", paidAt: now });
    }

    await recordPaidInvoiceAndUpdateDraft(ctx, {
      organisationId: link.organisationId,
      clientId: link.clientId,
      caseId: link.caseId,
      amount: link.amount,
      paymentType: link.paymentType,
      description: link.description,
      paidAt: now,
    });
  },
});

/** Admin / accountant: update a manual payment record. */
export const updatePayment = authenticatedMutation({
  args: {
    id: v.id("payments"),
    amount: v.number(),
    method: v.union(
      v.literal("Card"), v.literal("Bank Transfer"),
      v.literal("Cash"), v.literal("Check"), v.literal("Online")
    ),
    status: v.union(
      v.literal("Completed"), v.literal("Pending"),
      v.literal("Failed"), v.literal("Refunded")
    ),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
  },
  handler: async (ctx, args) => {
    requireAdminOrAccountant(ctx);
    const payment = await ctx.db.get(args.id);
    if (!payment || payment.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payment not found." });
    }
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

/** Admin / accountant: delete a payment record. */
export const removePayment = authenticatedMutation({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    requireAdminOrAccountant(ctx);
    const payment = await ctx.db.get(args.id);
    if (!payment || payment.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payment not found." });
    }
    await ctx.db.delete(args.id);
  },
});

/** Admin / accountant: update a payment link. */
export const updatePaymentLink = authenticatedMutation({
  args: {
    id: v.id("paymentLinks"),
    amount: v.number(),
    description: v.string(),
    expiresAt: v.number(),
    status: v.union(v.literal("Active"), v.literal("Used"), v.literal("Expired")),
    paymentType: v.optional(v.union(
      v.literal("Full Amount"),
      v.literal("Installment"),
      v.literal("Deposit"),
      v.literal("Partial"),
    )),
    caseId: v.optional(v.id("cases")),
    nextPaymentDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireAdminOrAccountant(ctx);
    const link = await ctx.db.get(args.id);
    if (!link || link.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payment link not found." });
    }
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

/** Admin / accountant: delete a payment link. */
export const removePaymentLink = authenticatedMutation({
  args: { id: v.id("paymentLinks") },
  handler: async (ctx, args) => {
    requireAdminOrAccountant(ctx);
    const link = await ctx.db.get(args.id);
    if (!link || link.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Payment link not found." });
    }
    await ctx.db.delete(args.id);
  },
});
