import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

/**
 * Single query that returns all stats + preview lists for the dashboard.
 * Role-based:
 *   - admin: sees all org data
 *   - case_manager / staff: sees only cases and tasks assigned to them;
 *     totalClients is the distinct set of clients from their assigned cases.
 * Monthly revenue and overdue invoices are fetched for admin only.
 */
export const stats = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const orgId = ctx.user.organisationId;
    const userId = ctx.user._id;
    const isAdmin = ctx.user.role === "admin";
    const now = Date.now();
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;

    // ── Cases (role-filtered) ────────────────────────────────────────────────
    const allOrgCases = await ctx.db
      .query("cases")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .collect();
    const scopedCases = isAdmin
      ? allOrgCases
      : allOrgCases.filter((c) => c.assignedTo === userId);

    // "Active" = not Completed and not Archive
    const activeCaseCount = scopedCases.filter(
      (c) => c.status !== "Completed" && c.status !== "Archive"
    ).length;

    // ── Tasks (role-filtered) ────────────────────────────────────────────────
    const allOrgTasks = await ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .collect();
    const scopedTasks = isAdmin
      ? allOrgTasks
      : allOrgTasks.filter((t) => t.assignedTo === userId);

    const completedTaskCount = scopedTasks.filter((t) => t.status === "Completed").length;

    const pendingTasksList = [...scopedTasks]
      .filter((t) => t.status !== "Completed" && t.status !== "Rejected")
      .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
      .slice(0, 5);

    // ── Clients ──────────────────────────────────────────────────────────────
    let totalClients: number;
    let recentClients: { _id: string; firstName: string; lastName: string; email: string; status: string; _creationTime: number }[] = [];

    if (isAdmin) {
      const allClients = await ctx.db
        .query("clients")
        .withIndex("by_org", (q) => q.eq("organisationId", orgId))
        .collect();
      totalClients = allClients.length;
      recentClients = [...allClients]
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 5);
    } else {
      const uniqueClientIds = [...new Set(scopedCases.map((c) => c.clientId as string))];
      totalClients = uniqueClientIds.length;
      const clientDocs = await Promise.all(
        uniqueClientIds.slice(0, 5).map((id) => ctx.db.get(id as Id<"clients">))
      );
      recentClients = clientDocs.filter(
        (c): c is NonNullable<typeof c> => c !== null
      ) as typeof recentClients;
    }

    // ── Admin-only: revenue + overdue invoices ───────────────────────────────
    let overdueInvoices = 0;
    let monthlyRevenue = 0;
    if (isAdmin) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [overdueInvs, paidInvs] = await Promise.all([
        ctx.db
          .query("invoices")
          .withIndex("by_org_and_status", (q) =>
            q.eq("organisationId", orgId).eq("status", "Overdue")
          )
          .collect(),
        ctx.db
          .query("invoices")
          .withIndex("by_org_and_status", (q) =>
            q.eq("organisationId", orgId).eq("status", "Paid")
          )
          .collect(),
      ]);
      overdueInvoices = overdueInvs.length;
      monthlyRevenue = paidInvs
        .filter((inv) => inv.paidAt && inv.paidAt >= monthStart.getTime())
        .reduce((sum, inv) => sum + inv.total, 0);
    }

    // ── Upcoming appointments (org-wide, next 7 days) ────────────────────────
    const [scheduledAppts, confirmedAppts] = await Promise.all([
      ctx.db
        .query("appointments")
        .withIndex("by_org_and_status", (q) =>
          q.eq("organisationId", orgId).eq("status", "Scheduled")
        )
        .collect(),
      ctx.db
        .query("appointments")
        .withIndex("by_org_and_status", (q) =>
          q.eq("organisationId", orgId).eq("status", "Confirmed")
        )
        .collect(),
    ]);
    const upcomingAppointments = [...scheduledAppts, ...confirmedAppts]
      .filter((a) => a.startAt >= now && a.startAt <= sevenDays)
      .sort((a, b) => a.startAt - b.startAt);

    // ── Recent cases (role-filtered) ─────────────────────────────────────────
    const recentCases = [...scopedCases]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 5);

    return {
      totalClients,
      activeCases: activeCaseCount,
      completedTasks: completedTaskCount,
      overdueInvoices,
      upcomingAppointments: upcomingAppointments.length,
      monthlyRevenue,
      recentCases,
      recentClients,
      pendingTasksList,
      upcomingAppointmentsList: upcomingAppointments.slice(0, 3),
    };
  },
});

/**
 * Per-month aggregates for the trends chart.
 * Role-based: non-admins see only their assigned cases/tasks.
 * Revenue and clients metrics return 0 for non-admins.
 */
export const chartData = authenticatedQuery({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const orgId = ctx.user.organisationId;
    const userId = ctx.user._id;
    const isAdmin = ctx.user.role === "admin";
    const numMonths = args.months ?? 6;
    const now = new Date();

    const buckets = Array.from({ length: numMonths }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1 - i), 1);
      return {
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        start: d.getTime(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
      };
    });

    const [allInvoices, allOrgCases, allOrgClients, allAppointments, allOrgTasks] = await Promise.all([
      isAdmin
        ? ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect()
        : Promise.resolve([]),
      ctx.db.query("cases").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
      isAdmin
        ? ctx.db.query("clients").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect()
        : Promise.resolve([]),
      ctx.db.query("appointments").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
      ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
    ]);

    const allCases = isAdmin ? allOrgCases : allOrgCases.filter((c) => c.assignedTo === userId);
    const allTasks = isAdmin ? allOrgTasks : allOrgTasks.filter((t) => t.assignedTo === userId);

    return buckets.map((b) => ({
      label: b.label,
      revenue: isAdmin
        ? allInvoices
            .filter((inv) => inv.paidAt != null && inv.paidAt >= b.start && inv.paidAt <= b.end)
            .reduce((sum, inv) => sum + inv.total, 0)
        : 0,
      cases: allCases.filter((c) => c._creationTime >= b.start && c._creationTime <= b.end).length,
      clients: isAdmin
        ? allOrgClients.filter((c) => c._creationTime >= b.start && c._creationTime <= b.end).length
        : 0,
      appointments: allAppointments.filter((a) => a.startAt >= b.start && a.startAt <= b.end).length,
      tasksCompleted: allTasks.filter(
        (t) => t.status === "Completed" && t._creationTime >= b.start && t._creationTime <= b.end
      ).length,
    }));
  },
});

/**
 * Breakdown data for the pie and bar charts.
 * - casesByStatus: distribution of cases across all statuses (pie chart)
 * - casesPerClient: top 8 clients by case count (horizontal bar chart)
 * Role-filtered: non-admins see only their assigned cases.
 */
export const chartBreakdown = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const orgId = ctx.user.organisationId;
    const userId = ctx.user._id;
    const isAdmin = ctx.user.role === "admin";

    const allOrgCases = await ctx.db
      .query("cases")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .collect();
    const scopedCases = isAdmin
      ? allOrgCases
      : allOrgCases.filter((c) => c.assignedTo === userId);

    // Case status breakdown for pie chart
    const statusCounts: Record<string, number> = {};
    for (const c of scopedCases) {
      statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
    }
    const casesByStatus = Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // Cases per client (top 8) for horizontal bar chart
    const clientCaseCounts: Record<string, number> = {};
    for (const c of scopedCases) {
      const cId = c.clientId as string;
      clientCaseCounts[cId] = (clientCaseCounts[cId] ?? 0) + 1;
    }
    const topEntries = Object.entries(clientCaseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const casesPerClient = (
      await Promise.all(
        topEntries.map(async ([id, count]) => {
          const client = await ctx.db.get(id as Id<"clients">);
          return client
            ? { name: `${client.firstName} ${client.lastName}`, cases: count }
            : null;
        })
      )
    ).filter((x): x is { name: string; cases: number } => x !== null);

    return { casesByStatus, casesPerClient };
  },
});
