import { mutation, internalMutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { checkRateLimit } from "../lib/rateLimit";
import { requireAdmin, requireAdminOrAccountant } from "../lib/rbac";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Helper: atomically generate the next invoice number for an org.
 * Uses a dedicated counter document to prevent race conditions under concurrent mutations.
 * Convex serialises writes to the same document, guaranteeing uniqueness.
 */
async function nextInvoiceNumber(ctx: MutationCtx, organisationId: Id<"organisations">): Promise<string> {
  const counter = await ctx.db
    .query("invoiceCounters")
    .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
    .unique();

  if (counter) {
    const n = counter.nextNumber;
    await ctx.db.patch(counter._id, { nextNumber: n + 1 });
    return `INV-${String(n).padStart(4, "0")}`;
  }

  // First invoice for this org — seed the counter at 2 (this call uses 1)
  await ctx.db.insert("invoiceCounters", { organisationId, nextNumber: 2 });
  return "INV-0001";
}

/**
 * Helper: after a successful payment:
 * - If no existing invoice was linked to the payment link, create a new "Paid" receipt invoice.
 * - Update paidAmount on the client's contract Draft invoice (if any).
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
    invoiceId?: Id<"invoices">; // if provided, skip creating a new receipt invoice
  }
) {
  const amountInDollars = opts.amount / 100;

  // Only create a new receipt invoice when no invoice was already linked
  if (!opts.invoiceId) {
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
  }

  // Update paidAmount on the contract Draft invoice for this client
  const contractDraft = await ctx.db
    .query("invoices")
    .withIndex("by_client", (q) => q.eq("clientId", opts.clientId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isContractDraft"), true),
        q.eq(q.field("organisationId"), opts.organisationId)
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

    const client = await ctx.db.get(args.clientId);
    if (!client || client.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    if (args.caseId) {
      const c = await ctx.db.get(args.caseId);
      if (!c || c.organisationId !== ctx.user.organisationId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
      }
    }

    if (items.length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invoice must have at least one line item." });
    }
    if (taxRate < 0 || taxRate > 100) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Tax rate must be between 0 and 100." });
    }
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Item quantity must be greater than 0." });
      }
      if (item.unitPrice < 0) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Item unit price cannot be negative." });
      }
      if (item.description.trim().length === 0 || item.description.length > 500) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Item description must be between 1 and 500 characters." });
      }
    }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const invoiceNumber = await nextInvoiceNumber(ctx, ctx.user.organisationId);

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
    if (fields.notes !== undefined && fields.notes.length > 5000) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Notes cannot exceed 5000 characters." });
    }
    const invoice = await ctx.db.get(id);
    if (!invoice || invoice.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found." });
    }
    await ctx.db.patch(id, fields);
  },
});

/** Deletes an invoice and all its line items. Admin-only — accountants cannot delete financial records. */
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
    // Rate limit: max 100 manual payments per hour per org
    await checkRateLimit(ctx, `recordPayment:${ctx.user.organisationId}`, 100, 3_600_000);

    if (args.amount <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Payment amount must be greater than 0." });
    }
    if (args.amount > 100_000_000) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Payment amount exceeds the maximum allowed value." });
    }
    if (args.currency.length > 10) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid currency code." });
    }
    if (args.reference !== undefined && args.reference.length > 255) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Reference cannot exceed 255 characters." });
    }
    if (args.notes !== undefined && args.notes.length > 5000) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Notes cannot exceed 5000 characters." });
    }

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
    // Rate limit: max 5 attempts per token per hour (brute-force / double-submit protection)
    await checkRateLimit(ctx, `processPaymentLink:${args.token}`, 5, 3_600_000);

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

    const orgSettings = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", link.organisationId))
      .unique();
    const currency = orgSettings?.defaultCurrency ?? "USD";

    await ctx.db.insert("payments", {
      organisationId: link.organisationId,
      invoiceId: link.invoiceId,
      clientId: link.clientId,
      caseId: link.caseId,
      amount: link.amount,
      currency,
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
      invoiceId: link.invoiceId,
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

    if (args.description.trim().length === 0 || args.description.length > 500) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Description must be between 1 and 500 characters." });
    }
    if (args.amount <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Amount must be greater than 0." });
    }
    if (args.amount > 100_000_000) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Amount exceeds the maximum allowed value." });
    }

    const client = await ctx.db.get(args.clientId);
    if (!client || client.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    if (args.invoiceId) {
      const invoice = await ctx.db.get(args.invoiceId);
      if (!invoice || invoice.organisationId !== ctx.user.organisationId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Invoice not found." });
      }
    }
    if (args.caseId) {
      const c = await ctx.db.get(args.caseId);
      if (!c || c.organisationId !== ctx.user.organisationId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
      }
    }

    // Generate a cryptographically secure 128-bit token (32 hex chars)
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const urlToken = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

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
 * Record a portal case fee payment directly — no paymentLinks record needed.
 * Called by confirmCaseFeePayment after verifying the PaymentIntent with Stripe.
 * Idempotent via by_stripe_intent index.
 */
export const recordCaseFeePayment = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    amountCents: v.number(),
    nextPaymentDate: v.optional(v.number()),
    stripePaymentIntentId: v.string(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    // Idempotency — skip if already recorded
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_stripe_intent", (q) =>
        q.eq("organisationId", args.organisationId).eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .unique();
    if (existing) return;

    const now = Date.now();

    await ctx.db.insert("payments", {
      organisationId: args.organisationId,
      clientId: args.clientId,
      amount: args.amountCents,
      currency: args.currency,
      method: "Card",
      status: "Completed",
      paidAt: now,
      stripePaymentIntentId: args.stripePaymentIntentId,
      reference: args.stripePaymentIntentId,
      type: "case_fee",
    });

    await recordPaidInvoiceAndUpdateDraft(ctx, {
      organisationId: args.organisationId,
      clientId: args.clientId,
      amount: args.amountCents,
      description: "Case fee payment",
      paidAt: now,
    });

    if (args.nextPaymentDate) {
      await ctx.db.patch(args.clientId, { nextPaymentDate: args.nextPaymentDate });
    }

    const client = await ctx.db.get(args.clientId);
    if (client) {
      await ctx.db.insert("portalNotifications", {
        organisationId: args.organisationId,
        clientId: args.clientId,
        type: "payment_received",
        title: "Payment Received",
        message: `Your payment of ${(args.amountCents / 100).toFixed(2)} ${args.currency.toUpperCase()} has been received and recorded against your case fee.`,
        read: false,
      });
    }
  },
});

/**
 * Internal mutation — called by the Stripe webhook action after verifying signature.
 * Idempotent: skips if the PaymentIntent was already recorded.
 * organisationId is passed from the webhook handler and verified against the payment link
 * to ensure the signature was verified with the correct org's secret.
 */
export const processStripeWebhookPayment = internalMutation({
  args: {
    token: v.string(),
    stripePaymentIntentId: v.string(),
    amount: v.number(),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("paymentLinks")
      .withIndex("by_token", (q) => q.eq("urlToken", args.token))
      .unique();

    if (!link || link.status === "Used") return; // already processed

    // Verify the payment link belongs to the organisation whose webhook secret was used
    if (link.organisationId !== args.organisationId) return;

    const now = Date.now();

    const orgSettings = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", link.organisationId))
      .unique();
    const currency = orgSettings?.defaultCurrency ?? "USD";

    const paymentType = link.isPortalCaseFee
      ? ("case_fee" as const)
      : link.appointmentPricingId
      ? ("appointment" as const)
      : undefined;

    const paymentId = await ctx.db.insert("payments", {
      organisationId: link.organisationId,
      invoiceId: link.invoiceId,
      clientId: link.clientId,
      caseId: link.caseId,
      amount: args.amount,
      currency,
      method: "Card",
      status: "Completed",
      paidAt: now,
      stripePaymentIntentId: args.stripePaymentIntentId,
      reference: args.stripePaymentIntentId,
      ...(paymentType ? { type: paymentType } : {}),
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
      invoiceId: link.invoiceId,
    });

    // ── Always apply nextPaymentDate if set on the link (any payment type) ────────
    if (link.nextPaymentDate) {
      await ctx.db.patch(link.clientId, { nextPaymentDate: link.nextPaymentDate });
    }

    // ── Case fee payment: send portal notification ──────────────────────────────
    if (link.isPortalCaseFee) {
      const client = await ctx.db.get(link.clientId);
      if (client) {
        await ctx.db.insert("portalNotifications", {
          organisationId: link.organisationId,
          clientId: link.clientId,
          type: "payment_received",
          title: "Payment Received",
          message: `Your payment of ${(args.amount / 100).toFixed(2)} ${currency.toUpperCase()} has been received and recorded against your case fee.`,
          read: false,
        });
      }
      return; // No appointment to create for case fee payments
    }

    // Auto-create appointment for portal-initiated appointment booking payments
    if (link.appointmentPricingId && link.pendingAppointmentAt) {
      const pricing = await ctx.db.get(link.appointmentPricingId);
      if (pricing) {
        const durationMs = (link.pendingAppointmentDuration ?? 60) * 60_000;
        const endAt = link.pendingAppointmentAt + durationMs;

        // Determine host (case manager) — prefer explicitly linked case, then fallback
        let hostUserId: Id<"users"> | undefined;
        let caseId: Id<"cases"> | undefined = link.caseId;

        if (caseId) {
          const linkedCase = await ctx.db.get(caseId);
          if (linkedCase?.assignedTo) hostUserId = linkedCase.assignedTo;
        } else {
          const activeCase = await ctx.db
            .query("cases")
            .withIndex("by_client", (q) => q.eq("clientId", link.clientId))
            .filter((q) => q.neq(q.field("status"), "Archive"))
            .first();
          if (activeCase) {
            caseId = activeCase._id;
            if (activeCase.assignedTo) hostUserId = activeCase.assignedTo;
          }
        }

        // Build attendees: host + all unique task assignees on the case + the client
        const attendees: Array<{ type: "internal" | "external"; userId?: Id<"users">; email: string; name: string }> = [];
        const seenUserIds = new Set<string>();

        const addUser = async (userId: Id<"users">) => {
          if (seenUserIds.has(userId)) return;
          seenUserIds.add(userId);
          const u = await ctx.db.get(userId);
          if (u) attendees.push({ type: "internal", userId, email: u.email, name: u.fullName });
        };

        if (hostUserId) await addUser(hostUserId);

        if (caseId) {
          const tasks = await ctx.db
            .query("tasks")
            .withIndex("by_case", (q) => q.eq("caseId", caseId!))
            .collect();
          for (const task of tasks) {
            if (task.assignedTo) await addUser(task.assignedTo);
          }
        }

        const client = await ctx.db.get(link.clientId);
        if (client) {
          attendees.push({ type: "external", email: client.email, name: `${client.firstName} ${client.lastName}`.trim() });
        }

        const apptModality = link.modality ?? "online";
        const modalityLabel = apptModality === "offline" ? "In-Person" : "Online";

        const appointmentId = await ctx.db.insert("appointments", {
          organisationId: link.organisationId,
          clientId: link.clientId,
          caseId,
          title: `${pricing.appointmentType} · ${modalityLabel} (Portal Booking)`,
          meetingType: caseId ? "case_appointment" : "general_meeting",
          type: pricing.appointmentType,
          modality: apptModality,
          status: "PendingApproval",
          portalBooking: true,
          startAt: link.pendingAppointmentAt,
          endAt,
          assignedTo: hostUserId,
          attendees,
        });

        // Link payment → appointment for future refund lookups
        await ctx.db.patch(paymentId, { appointmentId });

        // Notify case manager / admin for approval
        await ctx.scheduler.runAfter(0, internal.appointments.jobs.notifyPendingApproval, {
          appointmentId,
        });

        // Portal notification to the client — pending approval
        if (client) {
          await ctx.db.insert("portalNotifications", {
            organisationId: link.organisationId,
            clientId: link.clientId,
            type: "appointment_pending",
            title: "Appointment request received",
            message: `Your ${pricing.appointmentType} appointment request is awaiting confirmation from your case manager.`,
            entityType: "appointment",
            entityId: appointmentId,
            read: false,
          });
        }
      }
    }
  },
});

/**
 * Internal mutation — creates a payment link for a portal-initiated appointment booking.
 * No Clerk auth required (portal session is validated in the HTTP action).
 */
export const createPortalPaymentLink = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    amount: v.number(),
    description: v.string(),
    appointmentPricingId: v.id("appointmentPricing"),
    pendingAppointmentAt: v.number(),
    pendingAppointmentDuration: v.number(),
    caseId: v.optional(v.id("cases")),
    modality: v.optional(v.union(v.literal("online"), v.literal("offline"))),
  },
  handler: async (ctx, args) => {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const urlToken = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    return await ctx.db.insert("paymentLinks", {
      organisationId: args.organisationId,
      clientId: args.clientId,
      caseId: args.caseId,
      amount: args.amount,
      description: args.description,
      status: "Active",
      paymentType: "Full Amount",
      urlToken,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      appointmentPricingId: args.appointmentPricingId,
      pendingAppointmentAt: args.pendingAppointmentAt,
      pendingAppointmentDuration: args.pendingAppointmentDuration,
      modality: args.modality ?? "online",
    });
  },
});

// confirmStripePayment has been moved to billing/actions.ts as a server-side
// verified action. The frontend now calls api.billing.actions.confirmStripePayment.

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
      v.literal("Failed"), v.literal("Refunded"), v.literal("On Hold")
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

    // When manually marking a payment as Refunded, reopen the linked invoice
    // so the client portal reflects the correct status.
    if (args.status === "Refunded" && payment.status !== "Refunded" && payment.invoiceId) {
      const invoice = await ctx.db.get(payment.invoiceId);
      if (invoice?.status === "Paid") {
        await ctx.db.patch(payment.invoiceId, { status: "Sent", paidAt: undefined });
      }
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL MUTATIONS — called by billing actions (webhook + refund handlers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal: rate-limit check callable from actions.
 * Actions cannot use MutationCtx directly, so they call this via ctx.runMutation.
 */
export const checkRateLimitPublic = internalMutation({
  args: {
    key: v.string(),
    maxRequests: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    await checkRateLimit(ctx, args.key, args.maxRequests, args.windowMs);
  },
});

/**
 * Helper: subtract a refunded amount (in cents) from the client's contract draft paidAmount.
 * Safe to call multiple times — clamps to 0.
 */
async function subtractFromContractDraft(
  ctx: MutationCtx,
  clientId: Id<"clients">,
  organisationId: Id<"organisations">,
  refundedCents: number
) {
  const contractDraft = await ctx.db
    .query("invoices")
    .withIndex("by_client", (q) => q.eq("clientId", clientId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isContractDraft"), true),
        q.eq(q.field("organisationId"), organisationId)
      )
    )
    .first();

  if (contractDraft && (contractDraft.paidAmount ?? 0) > 0) {
    const newPaidAmount = Math.max(0, (contractDraft.paidAmount ?? 0) - refundedCents / 100);
    await ctx.db.patch(contractDraft._id, { paidAmount: newPaidAmount });
  }
}

/** Marks a payment as Refunded by its Convex ID. Called by refundPayment action. */
export const markPaymentRefunded = internalMutation({
  args: {
    paymentId: v.id("payments"),
    stripeRefundId: v.string(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) return;
    await ctx.db.patch(args.paymentId, {
      status: "Refunded",
      notes: payment.notes
        ? `${payment.notes} | Stripe refund: ${args.stripeRefundId}`
        : `Stripe refund: ${args.stripeRefundId}`,
    });
    // Reopen the associated invoice back to Sent if it was Paid
    if (payment.invoiceId) {
      const invoice = await ctx.db.get(payment.invoiceId);
      if (invoice?.status === "Paid") {
        await ctx.db.patch(payment.invoiceId, { status: "Sent", paidAt: undefined });
      }
    }
    // Deduct the refunded amount from the client's contract draft paidAmount (skip for prospect payments)
    if (payment.clientId) {
      await subtractFromContractDraft(ctx, payment.clientId, payment.organisationId, payment.amount);
    }
  },
});

/**
 * Marks a payment as Refunded by its Stripe PaymentIntent ID.
 * Called by the charge.refunded webhook handler.
 */
export const markPaymentRefundedByIntentId = internalMutation({
  args: {
    stripePaymentIntentId: v.string(),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_stripe_intent", (q) =>
        q
          .eq("organisationId", args.organisationId)
          .eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first();
    if (!payment || payment.status === "Refunded") return;
    await ctx.db.patch(payment._id, { status: "Refunded" });
    // Reopen the associated invoice
    if (payment.invoiceId) {
      const invoice = await ctx.db.get(payment.invoiceId);
      if (invoice?.status === "Paid") {
        await ctx.db.patch(payment.invoiceId, { status: "Sent", paidAt: undefined });
      }
    }
    // Deduct the refunded amount from the client's contract draft paidAmount (skip for prospect payments)
    if (payment.clientId) {
      await subtractFromContractDraft(ctx, payment.clientId, payment.organisationId, payment.amount);
    }
  },
});

/** Creates a dispute record from a charge.dispute.created webhook. */
export const createDispute = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    stripeDisputeId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    reason: v.string(),
    status: v.union(
      v.literal("warning_needs_response"),
      v.literal("warning_under_review"),
      v.literal("warning_closed"),
      v.literal("needs_response"),
      v.literal("under_review"),
      v.literal("charge_refunded"),
      v.literal("won"),
      v.literal("lost")
    ),
    dueBy: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Avoid duplicate dispute records
    const existing = await ctx.db
      .query("disputes")
      .withIndex("by_stripe_dispute", (q) =>
        q.eq("stripeDisputeId", args.stripeDisputeId)
      )
      .first();
    if (existing) return;

    // Try to find the linked payment record
    let paymentId: Id<"payments"> | undefined;
    if (args.stripePaymentIntentId) {
      const payment = await ctx.db
        .query("payments")
        .withIndex("by_stripe_intent", (q) =>
          q
            .eq("organisationId", args.organisationId)
            .eq("stripePaymentIntentId", args.stripePaymentIntentId)
        )
        .first();
      if (payment) paymentId = payment._id;
    }

    const now = Date.now();
    await ctx.db.insert("disputes", {
      organisationId: args.organisationId,
      paymentId,
      stripeDisputeId: args.stripeDisputeId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      amount: args.amount,
      currency: args.currency,
      reason: args.reason,
      status: args.status,
      dueBy: args.dueBy,
      createdAt: now,
      updatedAt: now,
    });

    // Notify all admins in the org
    const admins = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .filter((q) =>
        q.and(
          q.eq(q.field("role"), "admin"),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();

    await Promise.all(
      admins.map((admin) =>
        ctx.db.insert("notifications", {
          organisationId: args.organisationId,
          recipientId: admin._id,
          type: "payment_dispute" as const,
          title: "Payment Dispute Received",
          message: `A chargeback has been filed for ${args.currency.toUpperCase()} ${(args.amount / 100).toFixed(2)}. Reason: ${args.reason}. Response due by: ${args.dueBy ? new Date(args.dueBy).toLocaleDateString() : "N/A"}.`,
          read: false,
        })
      )
    );
  },
});

/** Updates the status of an existing dispute record. */
export const updateDisputeStatus = internalMutation({
  args: {
    stripeDisputeId: v.string(),
    organisationId: v.id("organisations"),
    status: v.union(
      v.literal("warning_needs_response"),
      v.literal("warning_under_review"),
      v.literal("warning_closed"),
      v.literal("needs_response"),
      v.literal("under_review"),
      v.literal("charge_refunded"),
      v.literal("won"),
      v.literal("lost")
    ),
  },
  handler: async (ctx, args) => {
    const dispute = await ctx.db
      .query("disputes")
      .withIndex("by_stripe_dispute", (q) =>
        q.eq("stripeDisputeId", args.stripeDisputeId)
      )
      .first();
    if (!dispute || dispute.organisationId !== args.organisationId) return;
    await ctx.db.patch(dispute._id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

/** Appends a webhook event to the audit log. */
/** Internal: patch payment status + optional stripeRefundId (used by portal refund action). */
export const patchPaymentStatus = internalMutation({
  args: {
    paymentId: v.id("payments"),
    status: v.union(v.literal("Completed"), v.literal("Pending"), v.literal("Failed"), v.literal("Refunded"), v.literal("On Hold"), v.literal("Voided")),
    stripeRefundId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { paymentId, ...fields } = args;
    await ctx.db.patch(paymentId, fields);
  },
});

/**
 * Record a Stripe payment for a prospect appointment request.
 * clientId is intentionally absent — the prospect has not been converted to a client yet.
 * Idempotent via by_stripe_intent index.
 */
export const recordProspectPayment = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    requestId: v.id("appointmentRequests"),
    appointmentId: v.optional(v.id("appointments")),
    amountCents: v.number(),
    currency: v.string(),
    stripePaymentIntentId: v.string(),
    prospectName: v.string(),
    appointmentType: v.string(),
  },
  handler: async (ctx, args) => {
    // Idempotency — skip if already recorded
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_stripe_intent", (q) =>
        q.eq("organisationId", args.organisationId).eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .unique();
    if (existing) return;

    await ctx.db.insert("payments", {
      organisationId: args.organisationId,
      amount: args.amountCents,
      currency: args.currency,
      method: "Card",
      status: "Completed",
      paidAt: Date.now(),
      stripePaymentIntentId: args.stripePaymentIntentId,
      reference: args.stripePaymentIntentId,
      requestId: args.requestId,
      appointmentId: args.appointmentId,
      type: "appointment",
      clientName: args.prospectName, // snapshot — no clientId yet
      notes: `Prospect appointment: ${args.appointmentType}`,
    });
  },
});

export const insertWebhookLog = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    stripeEventId: v.string(),
    eventType: v.string(),
    status: v.union(v.literal("processed"), v.literal("skipped"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookLogs", {
      ...args,
      processedAt: Date.now(),
    });
  },
});
