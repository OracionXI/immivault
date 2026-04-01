/**
 * Real-time portal queries — previously called directly from the browser via useQuery.
 * Now all portal data is fetched via HTTP API routes instead.
 * These queries are kept for potential future use and return empty/null when not authenticated.
 *
 * Auth is via the portal JWT (RS256, issued by Next.js, verified by Convex).
 * clientId and orgId come from JWT claims — never from untrusted args.
 */

import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// ── Auth helper ───────────────────────────────────────────────────────────────

type PortalIdentity = {
  clientId: Id<"clients">;
  orgId: Id<"organisations">;
};

/** Inline parse of the `sub` claim format: "portal|{clientId}|{orgId}" */
function parsePortalSub(subject: string): { clientId: string; orgId: string } | null {
  const parts = subject.split("|");
  if (parts.length !== 3 || parts[0] !== "portal") return null;
  return { clientId: parts[1], orgId: parts[2] };
}

async function getPortalIdentity(ctx: { auth: { getUserIdentity(): Promise<unknown> } }): Promise<PortalIdentity | null> {
  const identity = await ctx.auth.getUserIdentity() as { subject: string } | null;
  if (!identity) return null;
  const parsed = parsePortalSub(identity.subject);
  if (!parsed) return null;
  return {
    clientId: parsed.clientId as Id<"clients">,
    orgId: parsed.orgId as Id<"organisations">,
  };
}

// ── Live queries ──────────────────────────────────────────────────────────────

export const getCases = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getPortalIdentity(ctx);
    if (!identity) return [];
    const { clientId, orgId } = identity;

    const cases = await ctx.db
      .query("cases")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();

    const filtered = cases.filter(
      (c) => c.organisationId === orgId && c.status !== "Archive"
    );

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

export const getInvoices = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getPortalIdentity(ctx);
    if (!identity) return { invoices: [], paymentLinks: [] };
    const { clientId, orgId } = identity;

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();

    const links = await ctx.db
      .query("paymentLinks")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .collect();

    return {
      invoices: invoices
        .filter((inv) => inv.organisationId === orgId && !inv.isContractDraft)
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
        .sort((a, b) => b.dueDate - a.dueDate),

      paymentLinks: links
        .filter(
          (l) =>
            l.clientId === clientId &&
            l.status === "Active" &&
            l.expiresAt > Date.now()
        )
        .map((l) => ({
          _id: l._id,
          invoiceId: l.invoiceId ?? null,
          amount: l.amount,
          description: l.description,
          urlToken: l.urlToken,
          expiresAt: l.expiresAt,
        })),
    };
  },
});

export const getPayments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getPortalIdentity(ctx);
    if (!identity) return null;
    const { clientId, orgId } = identity;

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_client", (q) =>
        q.eq("clientId", clientId).eq("organisationId", orgId)
      )
      .collect();

    const settings = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .unique();

    const client = await ctx.db.get(clientId);

    const contractAmountCents = client?.contractAmount ?? 0;
    const currency = settings?.defaultCurrency ?? "USD";
    const stripeEnabled =
      (settings?.stripeEnabled ?? false) && !!(settings?.stripePublishableKey);

    const completedPayments = payments.filter((p) => p.status === "Completed" && p.type !== "appointment");
    const totalPaidCents = completedPayments.reduce((s, p) => s + p.amount, 0);
    const outstandingCents = Math.max(0, contractAmountCents - totalPaidCents);

    return {
      payments: payments
        .filter((p) =>
          p.status === "Completed" ||
          p.status === "Refunded" ||
          p.status === "On Hold" ||
          p.status === "Voided"
        )
        .map((p) => ({
          _id: p._id,
          amount: p.amount,
          currency: p.currency,
          method: p.method,
          reference: p.reference ?? null,
          paidAt: p.paidAt,
          type: p.type ?? null,
          status: p.status as "Completed" | "Refunded" | "On Hold" | "Voided",
        }))
        .sort((a, b) => b.paidAt - a.paidAt),

      contractSummary: {
        contractAmountCents,
        totalPaidCents,
        outstandingCents,
        nextPaymentDate: client?.nextPaymentDate ?? null,
        currency,
        stripeEnabled,
      },
    };
  },
});

export const getNotifications = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getPortalIdentity(ctx);
    if (!identity) return [];
    const { clientId, orgId } = identity;

    const notifs = await ctx.db
      .query("portalNotifications")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .order("desc")
      .take(50);

    return notifs.filter((n) => n.organisationId === orgId);
  },
});

export const getAppointments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getPortalIdentity(ctx);
    if (!identity) return null;
    const { clientId, orgId } = identity;

    const appts = await ctx.db
      .query("appointments")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();

    const settings = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .unique();

    const pricing = await ctx.db
      .query("appointmentPricing")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .collect()
      .then((list) => list.filter((p) => p.isActive));

    const filtered = appts.filter(
      (a) =>
        a.organisationId === orgId &&
        !a.deletedAt &&
        a.status !== "Cancelled"
    );

    const appointments = await Promise.all(
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

    return {
      appointments,
      pricing,
      orgTimezone: settings?.timezone ?? "UTC",
    };
  },
});

export const getDashboardDetail = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getPortalIdentity(ctx);
    if (!identity) return null;
    const { clientId, orgId } = identity;
    const now = Date.now();

    const [cases, invoices, appointments, client, orgSettings] =
      await Promise.all([
        ctx.db
          .query("cases")
          .withIndex("by_client", (q) => q.eq("clientId", clientId))
          .collect(),
        ctx.db
          .query("invoices")
          .withIndex("by_client", (q) => q.eq("clientId", clientId))
          .collect(),
        ctx.db
          .query("appointments")
          .withIndex("by_client", (q) => q.eq("clientId", clientId))
          .collect(),
        ctx.db.get(clientId),
        ctx.db
          .query("organisationSettings")
          .withIndex("by_org", (q) => q.eq("organisationId", orgId))
          .unique(),
      ]);

    const orgCurrency = (orgSettings?.defaultCurrency ?? "USD").toUpperCase();

    const overdueInvoices = invoices
      .filter(
        (i) =>
          i.organisationId === orgId &&
          !i.isContractDraft &&
          i.status === "Overdue"
      )
      .map((i) => ({
        _id: i._id,
        invoiceNumber: i.invoiceNumber,
        total: i.total,
        currency: orgCurrency,
      }));

    const nextPaymentDate = client?.nextPaymentDate ?? null;
    const nextPayment = nextPaymentDate
      ? { date: nextPaymentDate, currency: orgCurrency }
      : null;

    const upcomingAppts = appointments
      .filter(
        (a) =>
          a.organisationId === orgId &&
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

    const recentCases = cases
      .filter((c) => c.organisationId === orgId && c.status !== "Archive")
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

    const recentNotifications = await ctx.db
      .query("portalNotifications")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .order("desc")
      .take(5)
      .then((list) =>
        list
          .filter((n) => n.organisationId === orgId)
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
