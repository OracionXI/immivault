import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

/** Return the editable profile fields for a portal client (excludes admin-only fields). */
export const getClientProfile = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client || client.organisationId !== args.organisationId) return null;
    return {
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      prefix: client.prefix ?? null,
      middleName: client.middleName ?? null,
      dateOfBirth: client.dateOfBirth ?? null,
      maritalStatus: client.maritalStatus ?? null,
      languagePreference: client.languagePreference ?? null,
      nationality: client.nationality ?? null,
      countryOfBirth: client.countryOfBirth ?? null,
      passportNumber: client.passportNumber ?? null,
      mobilePhone: client.mobilePhone ?? null,
      address: client.address ?? null,
      profileCompleted: client.profileCompleted ?? false,
    };
  },
});

/** Get a single client by ID with org isolation check. */
export const getClientById = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client || client.organisationId !== args.organisationId) return null;
    return client;
  },
});

/** Get all cases for a client (portal view — read-only subset of fields). */
export const getCases = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Filter to this org and exclude archived
    const filtered = cases.filter(
      (c) => c.organisationId === args.organisationId && c.status !== "Archive"
    );

    // Resolve assignee names
    return await Promise.all(
      filtered.map(async (c) => {
        let assigneeName: string | null = null;
        if (c.assignedTo) {
          const user = await ctx.db.get(c.assignedTo);
          assigneeName = user?.fullName ?? null;
        }
        return {
          _id: c._id,
          caseNumber: c.caseNumber,
          title: c.title,
          visaType: c.visaType,
          status: c.status,
          priority: c.priority,
          deadline: c.deadline ?? null,
          assigneeName,
          updatedAt: c.updatedAt ?? c._creationTime,
        };
      })
    );
  },
});

/** Get all invoices for a client (portal view). */
export const getInvoices = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    return invoices
      .filter((inv) => inv.organisationId === args.organisationId && !inv.isContractDraft)
      .map((inv) => ({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        total: inv.total,
        status: inv.status,
        dueDate: inv.dueDate,
        issuedAt: inv.issuedAt ?? null,
        paidAt: inv.paidAt ?? null,
        paidAmount: inv.paidAmount ?? 0,
      }))
      .sort((a, b) => b.dueDate - a.dueDate);
  },
});

/** Get payment links for invoices (for the pay button in portal). */
export const getPaymentLinks = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("paymentLinks")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();

    return links
      .filter((l) => l.clientId === args.clientId && l.status === "Active" && l.expiresAt > Date.now())
      .map((l) => ({
        _id: l._id,
        invoiceId: l.invoiceId ?? null,
        amount: l.amount,
        description: l.description,
        urlToken: l.urlToken,
        expiresAt: l.expiresAt,
      }));
  },
});

/** Get payments for a client visible in their portal. Security: clientId + organisationId
 *  both come from the verified session — client cannot inject either value. */
export const getPayments = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    // Query client-first (by_client index) so we never touch another client's rows,
    // then verify organisationId as a second boundary.
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_client", (q) =>
        q.eq("clientId", args.clientId).eq("organisationId", args.organisationId)
      )
      .collect();

    return payments
      .filter((p) => p.status === "Completed" || p.status === "Refunded")
      .map((p) => ({
        _id: p._id,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        reference: p.reference ?? null,
        paidAt: p.paidAt,
        type: p.type ?? null,
        status: p.status as "Completed" | "Refunded",
      }))
      .sort((a, b) => b.paidAt - a.paidAt);
  },
});

/** Get upcoming appointments for a client. */
export const getAppointments = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const appts = await ctx.db
      .query("appointments")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    const now = Date.now();
    const filtered = appts.filter(
      (a) =>
        a.organisationId === args.organisationId &&
        !a.deletedAt &&
        a.status !== "Cancelled"
    );

    return await Promise.all(
      filtered.map(async (a) => {
        let assigneeName: string | null = null;
        if (a.assignedTo) {
          const user = await ctx.db.get(a.assignedTo);
          assigneeName = user?.fullName ?? null;
        }
        return {
          _id: a._id,
          title: a.title,
          type: a.type,
          status: a.status,
          modality: a.modality ?? null,
          startAt: a.startAt,
          endAt: a.endAt,
          assigneeName,
          googleMeetLink: a.googleMeetLink ?? null,
          notes: a.notes ?? null,
        };
      })
    ).then((list) => list.sort((a, b) => b.startAt - a.startAt));
  },
});

/** Get case detail for portal: notes, documents, and external comments. */
export const getCaseDetail = internalQuery({
  args: {
    caseId: v.id("cases"),
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.caseId);
    if (!c || c.organisationId !== args.organisationId || c.clientId !== args.clientId) return null;
    if (c.status === "Archive") return null;

    // Documents for this case
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();

    // External comments only
    const allComments = await ctx.db
      .query("comments")
      .withIndex("by_entity", (q) => q.eq("entityType", "case").eq("entityId", args.caseId))
      .order("asc")
      .collect();

    const externalComments = await Promise.all(
      allComments
        .filter((cm) => cm.visibility === "external")
        .map(async (cm) => {
          let authorName = "Staff";
          let isCurrentClient = false;
          if (cm.authorClientId) {
            const client = await ctx.db.get(cm.authorClientId);
            authorName = client ? `${client.firstName} ${client.lastName}` : "Client";
            isCurrentClient = cm.authorClientId === args.clientId;
          } else if (cm.authorId) {
            const user = await ctx.db.get(cm.authorId);
            authorName = user?.fullName ?? "Staff";
          }
          return {
            _id: cm._id as string,
            body: cm.body,
            authorName,
            isCurrentClient,
            createdAt: cm._creationTime,
          };
        })
    );

    return {
      notes: c.notes ?? null,
      documents: docs.map((d) => ({ _id: d._id as string, name: d.name, status: d.status, mimeType: d.mimeType })),
      externalComments,
    };
  },
});

/** Get a signed view URL for a document — only if it belongs to a case owned by this client. */
export const getDocumentUrl = internalQuery({
  args: {
    docId: v.id("documents"),
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.organisationId !== args.organisationId) return null;
    // Verify the document's case belongs to this client
    if (doc.caseId) {
      const c = await ctx.db.get(doc.caseId);
      if (!c || c.clientId !== args.clientId) return null;
    } else if (doc.clientId !== args.clientId) {
      return null;
    }
    return await ctx.storage.getUrl(doc.storageId);
  },
});

/** Get appointment pricing options for this org. */
export const getAppointmentPricing = internalQuery({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("appointmentPricing")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect()
      .then((list) => list.filter((p) => p.isActive));
  },
});

/** Get portal notifications for a client. */
export const getNotifications = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const notifs = await ctx.db
      .query("portalNotifications")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(50);

    return notifs.filter((n) => n.organisationId === args.organisationId);
  },
});

/** Get unread notification count. */
export const getUnreadNotificationCount = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("portalNotifications")
      .withIndex("by_client_unread", (q) => q.eq("clientId", args.clientId).eq("read", false))
      .collect();
    return unread.filter((n) => n.organisationId === args.organisationId).length;
  },
});

/** Get a single payment by ID with org + client isolation check (for refund actions). */
export const getPaymentById = internalQuery({
  args: {
    paymentId: v.id("payments"),
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.paymentId);
    if (!p || p.organisationId !== args.organisationId || p.clientId !== args.clientId) return null;
    return {
      _id: p._id,
      status: p.status,
      amount: p.amount,
      currency: p.currency,
      stripePaymentIntentId: p.stripePaymentIntentId ?? null,
    };
  },
});

/** Org Stripe settings (secret key, enabled flag) — for internal refund actions only. */
export const getOrgStripeSettings = internalQuery({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const s = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .unique();
    if (!s) return null;
    return {
      stripeEnabled: s.stripeEnabled ?? false,
      stripeSecretKey: s.stripeSecretKey,
      stripeSecretKeyEnc: s.stripeSecretKeyEnc,
    };
  },
});

/** Org timezone + booking settings — minimal, safe to return to portal. */
export const getOrgSettings = internalQuery({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const s = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .unique();
    return {
      timezone: s?.timezone ?? "UTC",
      bookingEnabled: s?.bookingEnabled ?? true,
    };
  },
});

/** Client's active cases with assignee info — for case selection in appointment booking. */
export const getCasesForBooking = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    const active = cases.filter(
      (c) =>
        c.organisationId === args.organisationId &&
        c.status !== "Archive" &&
        c.status !== "Completed"
    );

    return await Promise.all(
      active.map(async (c) => {
        let assigneeName: string | null = null;
        let assigneeId: string | null = null;
        let assigneeGoogleConnected = false;
        if (c.assignedTo) {
          const user = await ctx.db.get(c.assignedTo);
          assigneeName = user?.fullName ?? null;
          assigneeId = c.assignedTo as string;
          assigneeGoogleConnected = !!user?.googleRefreshToken;
        }
        return {
          _id: c._id as string,
          caseNumber: c.caseNumber,
          title: c.title,
          visaType: c.visaType,
          status: c.status,
          assigneeName,
          assigneeId,
          assigneeGoogleConnected,
        };
      })
    );
  },
});

/**
 * Contract fee summary for the portal payments page.
 * Returns total contract amount, amount paid so far (from contract draft invoice),
 * outstanding balance, next payment date, currency, and whether Stripe is enabled.
 */
export const getContractSummary = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client || client.organisationId !== args.organisationId) return null;

    const settings = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .unique();

    const currency = settings?.defaultCurrency ?? "USD";
    const stripeEnabled = (settings?.stripeEnabled ?? false) && !!(settings?.stripePublishableKey);
    const contractAmountCents = client.contractAmount ?? 0;

    // Compute totalPaid live from payments — summing only Completed (non-refunded) payments.
    // This is always accurate and immune to stale cached paidAmount on the contract draft.
    const allPayments = await ctx.db
      .query("payments")
      .withIndex("by_client", (q) =>
        q.eq("clientId", args.clientId).eq("organisationId", args.organisationId)
      )
      .collect();

    // Only count case_fee payments — appointment payments are billed separately
    // and must not reduce the contract fee outstanding balance.
    const totalPaidCents = allPayments
      .filter((p) => p.status === "Completed" && p.type !== "appointment")
      .reduce((sum, p) => sum + p.amount, 0);

    const outstandingCents = Math.max(0, contractAmountCents - totalPaidCents);

    return {
      contractAmountCents,
      totalPaidCents,
      outstandingCents,
      nextPaymentDate: client.nextPaymentDate ?? null,
      currency,
      stripeEnabled,
    };
  },
});

/** Dashboard summary stats. */
export const getDashboardStats = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const [cases, invoices, appointments] = await Promise.all([
      ctx.db
        .query("cases")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .collect(),
      ctx.db
        .query("invoices")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .collect(),
      ctx.db
        .query("appointments")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .collect(),
    ]);

    const activeCases = cases.filter(
      (c) => c.organisationId === args.organisationId && c.status !== "Archive" && c.status !== "Completed"
    ).length;

    const pendingInvoices = invoices.filter(
      (i) => i.organisationId === args.organisationId && !i.isContractDraft && (i.status === "Sent" || i.status === "Overdue")
    );
    const pendingTotal = pendingInvoices.reduce((s, i) => s + i.total, 0);

    const now = Date.now();
    const upcomingAppts = appointments.filter(
      (a) =>
        a.organisationId === args.organisationId &&
        !a.deletedAt &&
        a.status === "Upcoming" &&
        a.startAt > now
    ).length;

    return {
      activeCases,
      pendingInvoiceCount: pendingInvoices.length,
      pendingInvoiceTotal: pendingTotal,
      upcomingAppointments: upcomingAppts,
    };
  },
});

/** Enriched dashboard data: overdue invoices, next payment, next appointment, recent cases. */
export const getDashboardDetail = internalQuery({
  args: {
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const [cases, invoices, appointments, client, orgSettings] = await Promise.all([
      ctx.db
        .query("cases")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .collect(),
      ctx.db
        .query("invoices")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .collect(),
      ctx.db
        .query("appointments")
        .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
        .collect(),
      ctx.db.get(args.clientId),
      ctx.db
        .query("organisationSettings")
        .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
        .unique(),
    ]);

    const orgCurrency = (orgSettings?.defaultCurrency ?? "USD").toUpperCase();

    // ── Overdue invoices ─────────────────────────────────────────────────────
    const overdueInvoices = invoices
      .filter(
        (i) =>
          i.organisationId === args.organisationId &&
          !i.isContractDraft &&
          i.status === "Overdue"
      )
      .map((i) => ({
        _id: i._id,
        invoiceNumber: i.invoiceNumber,
        total: i.total,
        currency: orgCurrency,
      }));

    // ── Next payment due ─────────────────────────────────────────────────────
    const nextPaymentDate = client?.nextPaymentDate ?? null;
    const nextPayment = nextPaymentDate
      ? { date: nextPaymentDate, currency: orgCurrency }
      : null;

    // ── Next upcoming appointment ────────────────────────────────────────────
    const upcomingAppts = appointments
      .filter(
        (a) =>
          a.organisationId === args.organisationId &&
          !a.deletedAt &&
          (a.status === "Upcoming" || a.status === "PendingApproval") &&
          a.startAt > now
      )
      .sort((a, b) => a.startAt - b.startAt);

    let nextAppointment = null;
    if (upcomingAppts.length > 0) {
      const appt = upcomingAppts[0];
      let caseTitle: string | null = null;
      if (appt.caseId) {
        const relatedCase = await ctx.db.get(appt.caseId);
        caseTitle = relatedCase?.title ?? null;
      }
      nextAppointment = {
        _id: appt._id,
        title: appt.title,
        startAt: appt.startAt,
        endAt: appt.endAt,
        type: appt.type,
        modality: appt.modality ?? null,
        status: appt.status,
        caseTitle,
      };
    }

    // ── Recent active cases (last 3 by updatedAt or _creationTime) ───────────
    const recentCases = cases
      .filter(
        (c) =>
          c.organisationId === args.organisationId &&
          c.status !== "Archive"
      )
      .sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime))
      .slice(0, 3)
      .map((c) => ({
        _id: c._id,
        title: c.title,
        status: c.status,
        caseNumber: c.caseNumber,
        updatedAt: c.updatedAt ?? null,
        _creationTime: c._creationTime,
      }));

    // ── Recent notifications (peek — does NOT mark as read) ──────────────────
    const recentNotifications = await ctx.db
      .query("portalNotifications")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(5)
      .then((list) =>
        list
          .filter((n) => n.organisationId === args.organisationId)
          .map((n) => ({
            _id: n._id,
            type: n.type,
            title: n.title,
            message: n.message,
            read: n.read,
            _creationTime: n._creationTime,
          }))
      );

    return {
      overdueInvoices,
      nextPayment,
      nextAppointment,
      recentCases,
      recentNotifications,
    };
  },
});
