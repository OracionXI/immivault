import { authenticatedMutation } from "../lib/auth";
import { internalMutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "../lib/rbac";
import { internal } from "../_generated/api";

/** Internal — called by the public HTTP action. Creates the request and notifies admins. */
export const create = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    appointmentType: v.string(),
    preferredDate: v.string(),
    preferredTime: v.string(),
    preferredSlotUTC: v.optional(v.number()),
    clientTimezone: v.optional(v.string()),
    meetingMode: v.optional(v.union(v.literal("online"), v.literal("in_person"))),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requestId = await ctx.db.insert("appointmentRequests", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });

    // Notify all admins in the org
    const admins = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();

    for (const admin of admins) {
      await ctx.db.insert("notifications", {
        organisationId: args.organisationId,
        recipientId: admin._id,
        type: "prospect_request",
        title: "New appointment request",
        message: `${args.firstName} ${args.lastName} requested a ${args.appointmentType} appointment on ${args.preferredDate}.`,
        entityType: "appointment_request",
        entityId: requestId,
        read: false,
      });
    }

    return requestId;
  },
});

/**
 * Admin-only: confirm a prospect request.
 * Creates only the appointment record — the prospect is NOT converted to a client yet.
 * Client creation happens later via acceptAsClient after the meeting.
 */
export const confirm = authenticatedMutation({
  args: {
    requestId: v.id("appointmentRequests"),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);

    const req = await ctx.db.get(args.requestId);
    if (!req || req.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found." });
    }
    if (req.status !== "pending") {
      throw new ConvexError({ code: "CONFLICT", message: "This request has already been reviewed." });
    }

    // Fetch org — needed for portalSlug guard and email
    const org = await ctx.db.get(ctx.user.organisationId);

    // Resolve startAt
    const startAt = req.preferredSlotUTC
      ?? new Date(`${req.preferredDate}T${req.preferredTime}:00Z`).getTime();
    if (isNaN(startAt)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid appointment date or time on this request." });
    }
    const endAt = startAt + 60 * 60 * 1000;

    const isOnline = req.meetingMode === "online";

    // Check if there is a price configured for this appointment type
    const pricing = await ctx.db
      .query("appointmentPricing")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .collect()
      .then((list) =>
        list.find((p) => p.isActive && p.appointmentType === req.appointmentType)
      );
    const priceInCents = pricing?.priceInCents ?? 0;
    const isPaid = isOnline && priceInCents > 0;

    // Guard: paid appointments require a portal slug so the payment link can be built
    if (isPaid && !org?.portalSlug) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Cannot confirm a paid appointment: set up a portal slug in Settings → Client Portal first.",
      });
    }

    // Appointment starts as PendingApproval if payment is required, Upcoming otherwise.
    // No clientId/caseId yet — those are created when admin accepts the prospect as a client.
    const appointmentId = await ctx.db.insert("appointments", {
      organisationId: ctx.user.organisationId,
      assignedTo: args.assignedTo,
      createdBy: ctx.user._id,
      title: `${req.appointmentType} — ${req.firstName} ${req.lastName}`,
      meetingType: "case_appointment",
      type: req.appointmentType,
      status: isPaid ? "PendingApproval" : "Upcoming",
      modality: isOnline ? "online" : "offline",
      startAt,
      endAt,
      attendees: [{
        type: "client",
        email: req.email,
        name: `${req.firstName} ${req.lastName}`,
      }],
      notes: req.message,
    });

    const paymentDeadline = isPaid ? Date.now() + 7 * 24 * 60 * 60 * 1000 : undefined;

    // Mark the request as confirmed (or awaiting_payment if there is a price)
    await ctx.db.patch(args.requestId, {
      status: isPaid ? "awaiting_payment" : "confirmed",
      reviewedBy: ctx.user._id,
      reviewedAt: Date.now(),
      convertedAppointmentId: appointmentId,
      ...(isPaid && {
        paymentAmountCents: priceInCents,
        paymentCurrency: (pricing?.currency ?? "USD").toUpperCase(),
        paymentDeadline,
      }),
    });

    // For free online appointments: schedule Google Meet creation immediately
    if (isOnline && !isPaid) {
      await ctx.scheduler.runAfter(0, internal.googleCalendar.actions.createEvent, {
        appointmentId,
        creatorUserId: ctx.user._id,
      });
    }

    // Build the prospect-facing payment URL (only relevant if paid)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const orgSlug = org?.portalSlug ?? "";
    const payUrl = isPaid && orgSlug
      ? `${appUrl}/portal/${orgSlug}/pay/${args.requestId}`
      : undefined;

    // Schedule confirmation email to the prospect
    await ctx.scheduler.runAfter(0, internal.notifications.actions.sendProspectConfirmation, {
      clientEmail: req.email,
      clientFirstName: req.firstName,
      orgName: org?.name ?? "your legal team",
      founderName: ctx.user.fullName,
      appointmentType: req.appointmentType,
      preferredDate: req.preferredDate,
      preferredTime: req.preferredTime,
      clientTimezone: req.clientTimezone,
      meetingMode: req.meetingMode ?? "in_person",
      payUrl,
      paymentDeadline,
    });

    return { appointmentId };
  },
});

/** Admin-only: reject a prospect request with an optional reason. */
export const reject = authenticatedMutation({
  args: {
    requestId: v.id("appointmentRequests"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);

    const req = await ctx.db.get(args.requestId);
    if (!req || req.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found." });
    }
    if (req.status !== "pending") {
      throw new ConvexError({ code: "CONFLICT", message: "This request has already been reviewed." });
    }

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      rejectionReason: args.reason,
      reviewedBy: ctx.user._id,
      reviewedAt: Date.now(),
    });

    // Fetch org name for the email
    const org = await ctx.db.get(ctx.user.organisationId);

    // Schedule rejection email to the prospect (include admin's reason if provided)
    await ctx.scheduler.runAfter(0, internal.notifications.actions.sendProspectRejection, {
      clientEmail: req.email,
      clientFirstName: req.firstName,
      orgName: org?.name ?? "your legal team",
      appointmentType: req.appointmentType,
      reason: args.reason,
    });
  },
});

/** Admin-only: permanently delete a prospect request record. */
export const remove = authenticatedMutation({
  args: { requestId: v.id("appointmentRequests") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const req = await ctx.db.get(args.requestId);
    if (!req || req.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found." });
    }
    await ctx.db.delete(args.requestId);
  },
});

/** Internal: store the Stripe PaymentIntent ID on a request record (idempotent). */
export const setPaymentIntent = internalMutation({
  args: {
    requestId: v.id("appointmentRequests"),
    paymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, { paymentIntentId: args.paymentIntentId });
  },
});

/** Internal: expire all awaiting_payment requests whose deadline has passed. */
export const expireUnpaid = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Use the by_status index — avoids a full table scan across all orgs.
    const pending = await ctx.db
      .query("appointmentRequests")
      .withIndex("by_status", (q) => q.eq("status", "awaiting_payment"))
      .collect();

    const expired = pending.filter(
      (r) => r.paymentDeadline !== undefined && r.paymentDeadline < now
    );

    await Promise.all(
      expired.map(async (req) => {
        await ctx.db.patch(req._id, { status: "payment_expired" });

        // Cancel the linked appointment
        if (req.convertedAppointmentId) {
          const appt = await ctx.db.get(req.convertedAppointmentId);
          if (appt && appt.status === "PendingApproval") {
            await ctx.db.patch(req.convertedAppointmentId, { status: "Cancelled" });
          }
        }

        // Notify the client in their portal
        if (req.convertedClientId) {
          await ctx.db.insert("portalNotifications", {
            organisationId: req.organisationId,
            clientId: req.convertedClientId,
            type: "appointment_cancelled",
            title: "Appointment cancelled",
            message: "Your appointment could not be confirmed because payment was not completed within the 7-day window.",
            read: false,
          });
        }

        // Send expiry email to the prospect
        const org = await ctx.db.get(req.organisationId);
        await ctx.scheduler.runAfter(0, internal.notifications.actions.sendProspectPaymentExpired, {
          clientEmail: req.email,
          clientFirstName: req.firstName,
          orgName: org?.name ?? "your legal team",
          appointmentType: req.appointmentType,
          preferredDate: req.preferredDate,
        });
      })
    );
  },
});

/** Internal: mark a request as paid and activate the linked appointment. */
export const markPaid = internalMutation({
  args: {
    requestId: v.id("appointmentRequests"),
    paymentIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const req = await ctx.db.get(args.requestId);
    if (!req) return;

    await ctx.db.patch(args.requestId, {
      status: "paid",
      paidAt: Date.now(),
    });

    // Activate the linked appointment (move from PendingApproval → Upcoming)
    if (req.convertedAppointmentId) {
      const appt = await ctx.db.get(req.convertedAppointmentId);
      if (appt && appt.status === "PendingApproval") {
        await ctx.db.patch(req.convertedAppointmentId, { status: "Upcoming" });
      }
    }
  },
});

/**
 * Admin-only: accept a prospect as a full client after the meeting.
 * Creates the client record, an initial case, a billing invoice, and sends the portal invite.
 * Requires the contract amount to be provided (in cents).
 */
export const acceptAsClient = authenticatedMutation({
  args: {
    requestId: v.id("appointmentRequests"),
    contractAmountCents: v.number(),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);

    if (args.contractAmountCents <= 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Contract amount must be greater than 0." });
    }

    const req = await ctx.db.get(args.requestId);
    if (!req || req.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found." });
    }
    if (req.status !== "paid" && req.status !== "confirmed") {
      throw new ConvexError({ code: "CONFLICT", message: "Can only accept a prospect whose appointment is confirmed or paid." });
    }
    if (req.convertedClientId) {
      throw new ConvexError({ code: "CONFLICT", message: "This prospect has already been converted to a client." });
    }

    // Ensure no existing client in this org has the same email
    const emailNormalized = req.email.trim().toLowerCase();
    const duplicate = await ctx.db
      .query("clients")
      .withIndex("by_org_and_email", (q) =>
        q.eq("organisationId", ctx.user.organisationId).eq("email", emailNormalized)
      )
      .first();
    if (duplicate) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `A client with the email ${emailNormalized} already exists in your organisation.`,
      });
    }

    // Create the client
    const clientId = await ctx.db.insert("clients", {
      organisationId: ctx.user.organisationId,
      firstName: req.firstName,
      lastName: req.lastName,
      email: req.email,
      phone: req.phone,
      status: "Active",
      portalEnabled: true,
      assignedTo: args.assignedTo,
      contractAmount: args.contractAmountCents,
    });

    // Auto-create an initial case
    const date = new Date();
    const ymd =
      date.getFullYear().toString() +
      String(date.getMonth() + 1).padStart(2, "0") +
      String(date.getDate()).padStart(2, "0");
    const caseNumber = `IMV-${ymd}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const caseId = await ctx.db.insert("cases", {
      organisationId: ctx.user.organisationId,
      caseNumber,
      title: `${req.appointmentType} — ${req.firstName} ${req.lastName}`,
      clientId,
      visaType: "Consultation",
      status: "To Do",
      priority: "Medium",
      assignedTo: args.assignedTo,
      description: req.message,
    });

    // Link the existing appointment to the new client + case (if one was created)
    if (req.convertedAppointmentId) {
      await ctx.db.patch(req.convertedAppointmentId, { clientId, caseId });
    }

    // Generate invoice number via counter
    const counter = await ctx.db
      .query("invoiceCounters")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .unique();
    let invoiceNumber: string;
    if (counter) {
      const n = counter.nextNumber;
      await ctx.db.patch(counter._id, { nextNumber: n + 1 });
      invoiceNumber = `INV-${String(n).padStart(4, "0")}`;
    } else {
      await ctx.db.insert("invoiceCounters", { organisationId: ctx.user.organisationId, nextNumber: 2 });
      invoiceNumber = "INV-0001";
    }

    // Create a billing invoice for the contract amount
    const subtotal = args.contractAmountCents;
    const invoiceId = await ctx.db.insert("invoices", {
      organisationId: ctx.user.organisationId,
      clientId,
      caseId,
      invoiceNumber,
      status: "Draft",
      taxRate: 0,
      subtotal,
      taxAmount: 0,
      total: subtotal,
      dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      createdBy: ctx.user._id,
    });

    await ctx.db.insert("invoiceItems", {
      invoiceId,
      description: `${req.appointmentType} — Legal Services`,
      quantity: 1,
      unitPrice: args.contractAmountCents,
      total: args.contractAmountCents,
    });

    // Mark request as accepted
    await ctx.db.patch(args.requestId, {
      status: "accepted_as_client",
      convertedClientId: clientId,
    });

    // Send portal magic link invite
    await ctx.scheduler.runAfter(0, internal.portal.auth.sendInvite, {
      clientId,
      organisationId: ctx.user.organisationId,
    });

    return { clientId, caseId, invoiceId };
  },
});

/**
 * Admin-only: decline a prospect after the meeting (no email sent).
 * Marks the request as declined_after_meeting.
 */
export const declineAfterMeeting = authenticatedMutation({
  args: { requestId: v.id("appointmentRequests") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);

    const req = await ctx.db.get(args.requestId);
    if (!req || req.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Request not found." });
    }
    if (req.status !== "paid" && req.status !== "confirmed") {
      throw new ConvexError({ code: "CONFLICT", message: "Can only decline a prospect whose appointment is confirmed or paid." });
    }

    await ctx.db.patch(args.requestId, { status: "declined_after_meeting" });
  },
});
