import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";

/**
 * Single query that returns all stats + preview lists for the dashboard.
 * All data is scoped to the caller's organisation.
 */
export const stats = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const orgId = ctx.user.organisationId;
    const now = Date.now();
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;

    // ── Counts ──────────────────────────────────────────────────────────────────
    const allClients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .collect();

    const activeCases = await ctx.db
      .query("cases")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", orgId).eq("status", "Active")
      )
      .collect();

    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .collect();
    const pendingTasks = allTasks.filter((t) => t.status !== "Completed");

    const overdueInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", orgId).eq("status", "Overdue")
      )
      .collect();

    // ── Upcoming appointments (next 7 days) ──────────────────────────────────
    const scheduledAppts = await ctx.db
      .query("appointments")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", orgId).eq("status", "Scheduled")
      )
      .collect();
    const confirmedAppts = await ctx.db
      .query("appointments")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", orgId).eq("status", "Confirmed")
      )
      .collect();
    const upcomingAppointments = [...scheduledAppts, ...confirmedAppts]
      .filter((a) => a.startAt >= now && a.startAt <= sevenDays)
      .sort((a, b) => a.startAt - b.startAt);

    // ── Monthly revenue (paid invoices this calendar month) ──────────────────
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const paidInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_org_and_status", (q) =>
        q.eq("organisationId", orgId).eq("status", "Paid")
      )
      .collect();
    const monthlyRevenue = paidInvoices
      .filter((inv) => inv.paidAt && inv.paidAt >= monthStart.getTime())
      .reduce((sum, inv) => sum + inv.total, 0);

    // ── Preview lists ────────────────────────────────────────────────────────
    const allCases = await ctx.db
      .query("cases")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .order("desc")
      .take(5);

    const recentClients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .order("desc")
      .take(5);

    return {
      totalClients: allClients.length,
      activeCases: activeCases.length,
      pendingTasks: pendingTasks.length,
      overdueInvoices: overdueInvoices.length,
      upcomingAppointments: upcomingAppointments.length,
      monthlyRevenue,
      recentCases: allCases,
      recentClients,
      pendingTasksList: pendingTasks.slice(0, 5),
      upcomingAppointmentsList: upcomingAppointments.slice(0, 3),
    };
  },
});

/**
 * Returns per-month aggregates for the dashboard chart.
 * Covers the last `months` calendar months (default 6).
 */
export const chartData = authenticatedQuery({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const orgId = ctx.user.organisationId;
    const numMonths = args.months ?? 6;
    const now = new Date();

    // Build month buckets (oldest → newest)
    const buckets = Array.from({ length: numMonths }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1 - i), 1);
      return {
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        start: d.getTime(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
      };
    });

    // Fetch all org data once
    const [allInvoices, allCases, allClients, allAppointments, allTasks] = await Promise.all([
      ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
      ctx.db.query("cases").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
      ctx.db.query("clients").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
      ctx.db.query("appointments").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
      ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
    ]);

    return buckets.map((b) => ({
      label: b.label,
      revenue: allInvoices
        .filter((inv) => inv.paidAt != null && inv.paidAt >= b.start && inv.paidAt <= b.end)
        .reduce((sum, inv) => sum + inv.total, 0),
      cases: allCases.filter((c) => c._creationTime >= b.start && c._creationTime <= b.end).length,
      clients: allClients.filter((c) => c._creationTime >= b.start && c._creationTime <= b.end).length,
      appointments: allAppointments.filter((a) => a.startAt >= b.start && a.startAt <= b.end).length,
      tasksCompleted: allTasks.filter(
        (t) => t.status === "Completed" && t._creationTime >= b.start && t._creationTime <= b.end
      ).length,
    }));
  },
});
