import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v, ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";

/**
 * Client-facing: update their own profile fields and mark profile as complete.
 * Email is admin-controlled and excluded. firstName/lastName are client-editable.
 */
export const updateClientProfile = internalMutation({
  args: {
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    prefix: v.optional(v.string()),
    middleName: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    maritalStatus: v.optional(v.string()),
    languagePreference: v.optional(v.string()),
    nationality: v.optional(v.string()),
    countryOfBirth: v.optional(v.string()),
    passportNumber: v.optional(v.string()),
    mobilePhone: v.optional(v.string()),
    address: v.optional(v.string()),
    markComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { clientId, organisationId, markComplete, ...fields } = args;

    if (fields.prefix !== undefined && fields.prefix.length > 20)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Prefix cannot exceed 20 characters." });
    if (fields.maritalStatus !== undefined && fields.maritalStatus.length > 50)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Marital status cannot exceed 50 characters." });
    if (fields.languagePreference !== undefined && fields.languagePreference.length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Language preference cannot exceed 100 characters." });
    if (fields.firstName !== undefined && fields.firstName.trim().length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "First name cannot exceed 100 characters." });
    if (fields.lastName !== undefined && fields.lastName.trim().length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Last name cannot exceed 100 characters." });
    if (fields.middleName !== undefined && fields.middleName.length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Middle name cannot exceed 100 characters." });
    if (fields.nationality !== undefined && fields.nationality.length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nationality cannot exceed 100 characters." });
    if (fields.countryOfBirth !== undefined && fields.countryOfBirth.length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Country of birth cannot exceed 100 characters." });
    if (fields.passportNumber !== undefined && fields.passportNumber.length > 50)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Passport number cannot exceed 50 characters." });
    if (fields.mobilePhone !== undefined && fields.mobilePhone.length > 50)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Mobile phone cannot exceed 50 characters." });
    if (fields.address !== undefined && fields.address.length > 500)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Address cannot exceed 500 characters." });

    const client = await ctx.db.get(clientId);
    if (!client || client.organisationId !== organisationId) return;
    await ctx.db.patch(clientId, {
      ...fields,
      ...(markComplete ? { profileCompleted: true } : {}),
    });
  },
});

/** Mark all notifications as read for a client. */
export const markAllNotificationsRead = internalMutation({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("portalNotifications")
      .withIndex("by_client_unread", (q) => q.eq("clientId", args.clientId).eq("read", false))
      .collect();
    await Promise.all(
      unread
        .filter((n) => n.organisationId === args.organisationId)
        .map((n) => ctx.db.patch(n._id, { read: true }))
    );
  },
});

/** Insert a portal notification (used by staff-side mutations to notify clients). */
export const insertPortalNotification = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("portalNotifications", {
      ...args,
      read: false,
    });
  },
});

/**
 * Client cancels their own upcoming or pending-approval appointment.
 * If the appointment was paid, triggers a Stripe refund automatically.
 */
export const cancelPortalAppointment = internalMutation({
  args: {
    appointmentId: v.id("appointments"),
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.db.get(args.appointmentId);
    if (!appt || appt.organisationId !== args.organisationId || appt.clientId !== args.clientId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment not found." });
    }
    if (appt.status === "Cancelled") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Appointment is already cancelled." });
    }
    if (appt.status !== "Upcoming" && appt.status !== "PendingApproval") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only upcoming or pending appointments can be cancelled." });
    }
    if (appt.startAt <= Date.now()) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot cancel an appointment that has already started." });
    }

    await ctx.db.patch(args.appointmentId, {
      status: "Cancelled",
      deletedAt: Date.now(),
    });

    // Cancel Google Calendar event if it was created (only for approved appointments)
    if (appt.googleEventId && appt.assignedTo) {
      await ctx.scheduler.runAfter(0, internal.googleCalendar.actions.cancelEvent, {
        appointmentId: args.appointmentId,
        creatorUserId: appt.assignedTo,
      });
    }

    // Notify the staff host
    if (appt.assignedTo) {
      const client = await ctx.db.get(args.clientId);
      const clientName = client ? `${client.firstName} ${client.lastName}`.trim() : "A client";
      await ctx.db.insert("notifications", {
        organisationId: args.organisationId,
        recipientId: appt.assignedTo,
        type: "appointment_cancelled",
        title: "Appointment cancelled",
        message: `${clientName} cancelled their ${appt.type} appointment.`,
        entityType: "appointment",
        entityId: args.appointmentId,
        read: false,
      });
    }

    // Appointment fees are non-refundable — no refund is issued on cancellation.
    return { refundInitiated: false };
  },
});

/**
 * Client reschedules their own upcoming or pending-approval appointment to a new date/time.
 * The appointment is reset to PendingApproval so staff can re-confirm the new time.
 */
export const reschedulePortalAppointment = internalMutation({
  args: {
    appointmentId: v.id("appointments"),
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
    newStartAt: v.number(),
    newEndAt: v.number(),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.db.get(args.appointmentId);
    if (!appt || appt.organisationId !== args.organisationId || appt.clientId !== args.clientId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment not found." });
    }
    if (appt.status !== "Upcoming" && appt.status !== "PendingApproval") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Only upcoming or pending appointments can be rescheduled." });
    }

    const now = Date.now();
    if (args.newStartAt < now + 60 * 60_000) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "New time must be at least 1 hour from now." });
    }
    if (args.newStartAt > now + 60 * 24 * 60 * 60_000) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot reschedule more than 60 days in advance." });
    }

    // Cancel existing Google Calendar event (new one created after re-approval)
    if (appt.googleEventId && appt.assignedTo) {
      await ctx.scheduler.runAfter(0, internal.googleCalendar.actions.cancelEvent, {
        appointmentId: args.appointmentId,
        creatorUserId: appt.assignedTo,
      });
    }

    await ctx.db.patch(args.appointmentId, {
      startAt: args.newStartAt,
      endAt: args.newEndAt,
      status: "PendingApproval",
      googleEventId: undefined,
      googleMeetLink: undefined,
      approvedBy: undefined,
      approvedAt: undefined,
    });

    // Portal notification
    const client = await ctx.db.get(args.clientId);
    if (client) {
      await ctx.db.insert("portalNotifications", {
        organisationId: args.organisationId,
        clientId: args.clientId,
        type: "appointment_pending",
        title: "Reschedule request received",
        message: `Your ${appt.type} reschedule request is awaiting confirmation from your case manager.`,
        entityType: "appointment",
        entityId: args.appointmentId,
        read: false,
      });
    }

    // Notify staff for re-approval
    await ctx.scheduler.runAfter(0, internal.appointments.jobs.notifyPendingApproval, {
      appointmentId: args.appointmentId,
    });
  },
});

/** Upsert appointment pricing for a type. Admin-facing — called from HTTP route. */
export const upsertAppointmentPricing = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    appointmentType: v.string(),
    priceInCents: v.number(),
    currency: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appointmentPricing")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect()
      .then((list) => list.find((p) => p.appointmentType === args.appointmentType));

    if (existing) {
      await ctx.db.patch(existing._id, {
        priceInCents: args.priceInCents,
        currency: args.currency,
        description: args.description,
        isActive: args.isActive,
      });
    } else {
      await ctx.db.insert("appointmentPricing", args);
    }
  },
});

/**
 * Create a short-lived payment link for a client-initiated case fee payment.
 * The link is used to create a Stripe PaymentIntent; the webhook records the payment.
 * nextPaymentDate, if provided, must be ≤ 60 days from now — enforced in the HTTP route.
 */
export const createCaseFeePaymentLink = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    amountCents: v.number(),
    nextPaymentDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const urlToken = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    return await ctx.db.insert("paymentLinks", {
      organisationId: args.organisationId,
      clientId: args.clientId,
      amount: args.amountCents,
      description: "Case fee payment",
      status: "Active",
      paymentType: "Installment",
      urlToken,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes — inline payment, short window
      isPortalCaseFee: true,
      nextPaymentDate: args.nextPaymentDate,
    });
  },
});

/**
 * Record a direct appointment payment (no payment link) and create the appointment if payment succeeded.
 * Idempotent via by_stripe_intent index.
 */
export const recordDirectAppointmentPayment = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    amountCents: v.number(),
    currency: v.string(),
    stripePaymentIntentId: v.string(),
    appointmentType: v.string(),
    startAt: v.number(),
    durationMinutes: v.number(),
    caseId: v.optional(v.id("cases")),
    modality: v.optional(v.union(v.literal("online"), v.literal("offline"))),
    hostUserId: v.optional(v.id("users")),
    status: v.union(v.literal("Completed"), v.literal("On Hold"), v.literal("Failed")),
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
    const paymentId = await ctx.db.insert("payments", {
      organisationId: args.organisationId,
      clientId: args.clientId,
      caseId: args.caseId,
      amount: args.amountCents,
      currency: args.currency,
      method: "Card",
      status: args.status,
      paidAt: now,
      stripePaymentIntentId: args.stripePaymentIntentId,
      reference: args.stripePaymentIntentId,
      type: "appointment",
    });

    // Create appointment for both Completed and On Hold (auth hold) — but not for Failed
    if (args.status !== "Completed" && args.status !== "On Hold") return;

    // Build attendees
    const attendees: Array<{ type: "internal" | "external"; userId?: Id<"users">; email: string; name: string }> = [];
    const seenUserIds = new Set<string>();

    const addUser = async (userId: Id<"users">) => {
      if (seenUserIds.has(userId)) return;
      seenUserIds.add(userId);
      const u = await ctx.db.get(userId);
      if (u) attendees.push({ type: "internal", userId, email: u.email, name: u.fullName });
    };

    if (args.hostUserId) await addUser(args.hostUserId);

    if (args.caseId) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_case", (q) => q.eq("caseId", args.caseId!))
        .collect();
      for (const task of tasks) {
        if (task.assignedTo) await addUser(task.assignedTo);
      }
    }

    const client = await ctx.db.get(args.clientId);
    if (client) {
      attendees.push({ type: "external", email: client.email, name: `${client.firstName} ${client.lastName}`.trim() });
    }

    const modality = args.modality ?? "online";
    const modalityLabel = modality === "offline" ? "In-Person" : "Online";

    const appointmentId = await ctx.db.insert("appointments", {
      organisationId: args.organisationId,
      clientId: args.clientId,
      caseId: args.caseId,
      title: `${args.appointmentType} · ${modalityLabel} (Portal Booking)`,
      meetingType: args.caseId ? "case_appointment" : "general_meeting",
      type: args.appointmentType,
      modality,
      status: "PendingApproval",
      portalBooking: true,
      startAt: args.startAt,
      endAt: args.startAt + 3_600_000, // fixed 60-minute slots
      assignedTo: args.hostUserId,
      attendees,
    });

    await ctx.db.patch(paymentId, { appointmentId });

    if (client) {
      await ctx.db.insert("portalNotifications", {
        organisationId: args.organisationId,
        clientId: args.clientId,
        type: "appointment_pending",
        title: "Appointment request received",
        message: `Your ${args.appointmentType} appointment request is awaiting confirmation from your case manager.`,
        entityType: "appointment",
        entityId: appointmentId,
        read: false,
      });
    }

    await ctx.scheduler.runAfter(0, internal.appointments.jobs.notifyPendingApproval, {
      appointmentId,
    });
  },
});

/** Delete appointment pricing for a type. */
export const deleteAppointmentPricing = internalMutation({
  args: { id: v.id("appointmentPricing"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record || record.organisationId !== args.organisationId) return;
    await ctx.db.delete(args.id);
  },
});

/**
 * Book a zero-price portal appointment immediately (no payment required).
 * Creates the appointment, schedules Google Calendar event, and sends a portal notification.
 */
export const bookFreeAppointment = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    appointmentType: v.string(),
    modality: v.optional(v.union(v.literal("online"), v.literal("offline"))),
    startAt: v.number(),
    endAt: v.number(),
    hostUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Build attendees
    const attendees: Array<{ type: "internal" | "external"; userId?: Id<"users">; email: string; name: string }> = [];
    const seenUserIds = new Set<string>();

    const addUser = async (userId: Id<"users">) => {
      if (seenUserIds.has(userId)) return;
      seenUserIds.add(userId);
      const u = await ctx.db.get(userId);
      if (u) attendees.push({ type: "internal", userId, email: u.email, name: u.fullName });
    };

    if (args.hostUserId) await addUser(args.hostUserId);

    if (args.caseId) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_case", (q) => q.eq("caseId", args.caseId!))
        .collect();
      for (const task of tasks) {
        if (task.assignedTo) await addUser(task.assignedTo);
      }
    }

    const client = await ctx.db.get(args.clientId);
    if (client) {
      attendees.push({ type: "external", email: client.email, name: `${client.firstName} ${client.lastName}`.trim() });
    }

    const modality = args.modality ?? "online";
    const modalityLabel = modality === "offline" ? "In-Person" : "Online";

    const appointmentId = await ctx.db.insert("appointments", {
      organisationId: args.organisationId,
      clientId: args.clientId,
      caseId: args.caseId,
      title: `${args.appointmentType} · ${modalityLabel} (Portal Booking)`,
      meetingType: args.caseId ? "case_appointment" : "general_meeting",
      type: args.appointmentType,
      modality,
      status: "PendingApproval",
      portalBooking: true,
      startAt: args.startAt,
      endAt: args.endAt,
      assignedTo: args.hostUserId,
      attendees,
    });

    // Portal notification — pending, not confirmed yet
    if (client) {
      await ctx.db.insert("portalNotifications", {
        organisationId: args.organisationId,
        clientId: args.clientId,
        type: "appointment_pending",
        title: "Appointment request received",
        message: `Your ${args.appointmentType} appointment request is awaiting confirmation from your case manager.`,
        entityType: "appointment",
        entityId: appointmentId,
        read: false,
      });
    }

    // Notify the case manager / admin for approval
    await ctx.scheduler.runAfter(0, internal.appointments.jobs.notifyPendingApproval, {
      appointmentId,
    });
  },
});
