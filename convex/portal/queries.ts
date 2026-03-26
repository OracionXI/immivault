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

/** Get Stripe payments for a client. */
export const getPayments = internalQuery({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();

    return payments
      .filter((p) => p.clientId === args.clientId && p.status === "Completed")
      .map((p) => ({
        _id: p._id,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        reference: p.reference ?? null,
        paidAt: p.paidAt,
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
