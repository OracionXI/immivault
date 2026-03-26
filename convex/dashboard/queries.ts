import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

/** Returns { label: "+12%", up: true } for use in dashboard trend badges. */
function trendPct(curr: number, prev: number): { label: string; up: boolean } {
  if (curr === 0 && prev === 0) return { label: "0%", up: true };
  if (prev === 0) return { label: curr > 0 ? "+100%" : "0%", up: curr >= 0 };
  const raw = Math.round(((curr - prev) / Math.abs(prev)) * 100);
  return { label: `${raw >= 0 ? "+" : ""}${raw}%`, up: raw >= 0 };
}

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
    // accountants can see billing/revenue data but not cases/clients/tasks
    const canSeeBilling = ctx.user.role === "admin" || ctx.user.role === "accountant";
    const now = Date.now();
    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

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
    let allClientsFull: { _creationTime: number }[] = [];

    if (isAdmin) {
      const allClients = await ctx.db
        .query("clients")
        .withIndex("by_org", (q) => q.eq("organisationId", orgId))
        .collect();
      allClientsFull = allClients;
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

    // ── Billing data: visible to admin + accountant ──────────────────────────
    let overdueInvoices = 0;
    let monthlyRevenue = 0;
    let revenueLastMonth = 0;
    let pendingAmount = 0;
    let overdueInvsFull: { _creationTime: number }[] = [];
    if (canSeeBilling) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const lastMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1).getTime();
      const lastMonthEnd = monthStart.getTime() - 1;

      const [overdueInvs, allOrgPayments, allOrgInvoices, allBankTxns] = await Promise.all([
        ctx.db
          .query("invoices")
          .withIndex("by_org_and_status", (q) =>
            q.eq("organisationId", orgId).eq("status", "Overdue")
          )
          .collect(),
        ctx.db
          .query("payments")
          .withIndex("by_org", (q) => q.eq("organisationId", orgId))
          .collect(),
        ctx.db
          .query("invoices")
          .withIndex("by_org", (q) => q.eq("organisationId", orgId))
          .collect(),
        ctx.db
          .query("bankTransactions")
          .withIndex("by_org", (q) => q.eq("organisationId", orgId))
          .collect(),
      ]);
      overdueInvsFull = overdueInvs;
      overdueInvoices = overdueInvs.length;

      const stripeThisMonth = allOrgPayments
        .filter((p) => p.status === "Completed" && p.paidAt >= monthStart.getTime())
        .reduce((sum, p) => sum + p.amount, 0);
      const bankInThisMonth = allBankTxns
        .filter((t) => t.type === "money_in" && t.date >= monthStart.getTime())
        .reduce((sum, t) => sum + t.amount, 0);
      monthlyRevenue = (stripeThisMonth + bankInThisMonth) / 100;

      const stripeLastMonth = allOrgPayments
        .filter((p) => p.status === "Completed" && p.paidAt >= lastMonthStart && p.paidAt <= lastMonthEnd)
        .reduce((sum, p) => sum + p.amount, 0);
      const bankInLastMonth = allBankTxns
        .filter((t) => t.type === "money_in" && t.date >= lastMonthStart && t.date <= lastMonthEnd)
        .reduce((sum, t) => sum + t.amount, 0);
      revenueLastMonth = (stripeLastMonth + bankInLastMonth) / 100;

      // Pending = unpaid contract drafts balance + Sent/Overdue invoice totals
      for (const inv of allOrgInvoices) {
        if (inv.isContractDraft && inv.status !== "Paid") {
          pendingAmount += inv.total - (inv.paidAmount ?? 0);
        } else if (inv.status === "Sent" || inv.status === "Overdue") {
          pendingAmount += inv.total;
        }
      }
    }

    // ── Upcoming appointments (org-wide, next 7 days) ────────────────────────
    const [upcomingAppts, ongoingAppts] = await Promise.all([
      ctx.db
        .query("appointments")
        .withIndex("by_org_and_status", (q) =>
          q.eq("organisationId", orgId).eq("status", "Upcoming")
        )
        .collect(),
      ctx.db
        .query("appointments")
        .withIndex("by_org_and_status", (q) =>
          q.eq("organisationId", orgId).eq("status", "Ongoing")
        )
        .collect(),
    ]);
    const upcomingAppointments = [...upcomingAppts, ...ongoingAppts]
      .filter((a) => a.endAt >= now && a.startAt <= sevenDays) // include ongoing (started but not ended)
      .filter((a) =>
        isAdmin ||
        a.createdBy === userId ||
        a.assignedTo === userId ||
        (a.attendees ?? []).some((att: { userId?: string }) => att.userId === userId)
      )
      .sort((a, b) => a.startAt - b.startAt);

    // ── Recent cases (role-filtered) ─────────────────────────────────────────
    const recentCases = [...scopedCases]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 5);

    // ── Week-over-week / month-over-month trends ──────────────────────────────
    // Use scopedCases/scopedTasks so non-admins only see their own trends, not org-wide data
    const casesThisWeek = scopedCases.filter((c) => c._creationTime >= oneWeekAgo).length;
    const casesLastWeek = scopedCases.filter((c) => c._creationTime >= twoWeeksAgo && c._creationTime < oneWeekAgo).length;

    const tasksCompletedThisWeek = scopedTasks.filter((t) => t.status === "Completed" && t._creationTime >= oneWeekAgo).length;
    const tasksCompletedLastWeek = scopedTasks.filter((t) => t.status === "Completed" && t._creationTime >= twoWeeksAgo && t._creationTime < oneWeekAgo).length;

    const clientsThisWeek = allClientsFull.filter((c) => c._creationTime >= oneWeekAgo).length;
    const clientsLastWeek = allClientsFull.filter((c) => c._creationTime >= twoWeeksAgo && c._creationTime < oneWeekAgo).length;

    const allActiveAppts = [...upcomingAppts, ...ongoingAppts];
    const apptsThisWeek = allActiveAppts.filter((a) => a._creationTime >= oneWeekAgo).length;
    const apptsLastWeek = allActiveAppts.filter((a) => a._creationTime >= twoWeeksAgo && a._creationTime < oneWeekAgo).length;

    const overdueThisWeek = overdueInvsFull.filter((i) => i._creationTime >= oneWeekAgo).length;
    const overdueLastWeek = overdueInvsFull.filter((i) => i._creationTime >= twoWeeksAgo && i._creationTime < oneWeekAgo).length;

    const trends = {
      clients: trendPct(clientsThisWeek, clientsLastWeek),
      cases: trendPct(casesThisWeek, casesLastWeek),
      tasks: trendPct(tasksCompletedThisWeek, tasksCompletedLastWeek),
      revenue: trendPct(monthlyRevenue, revenueLastMonth),
      appointments: trendPct(apptsThisWeek, apptsLastWeek),
      overdueInvoices: trendPct(overdueThisWeek, overdueLastWeek),
    };

    return {
      totalClients,
      activeCases: activeCaseCount,
      completedTasks: completedTaskCount,
      overdueInvoices,
      upcomingAppointments: upcomingAppointments.length,
      monthlyRevenue,
      pendingAmount,
      recentCases,
      recentClients,
      pendingTasksList,
      upcomingAppointmentsList: upcomingAppointments.slice(0, 3),
      trends,
    };
  },
});

/**
 * Per-month aggregates for the trends chart.
 * Role-based: non-admins see only their assigned cases/tasks.
 * Revenue and clients metrics return 0 for non-admins.
 */
export const chartData = authenticatedQuery({
  args: { months: v.optional(v.number()), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const orgId = ctx.user.organisationId;
    const userId = ctx.user._id;
    const isAdmin = ctx.user.role === "admin";
    const canSeeBilling = ctx.user.role === "admin" || ctx.user.role === "accountant";
    const canSeeClients = ctx.user.role === "admin" || ctx.user.role === "accountant";
    const now = new Date();

    let buckets: { label: string; start: number; end: number }[];

    if (args.days) {
      const numDays = args.days;
      buckets = Array.from({ length: numDays }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (numDays - 1 - i));
        d.setHours(0, 0, 0, 0);
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        const label =
          numDays <= 7
            ? d.toLocaleDateString("en-US", { weekday: "short" })
            : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { label, start: d.getTime(), end: end.getTime() };
      });
    } else {
      const numMonths = args.months ?? 6;
      buckets = Array.from({ length: numMonths }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1 - i), 1);
        return {
          label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          start: d.getTime(),
          end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
        };
      });
    }

    const [allPayments, allOrgCases, allOrgClients, allAppointments, allOrgTasks, allBankTxns] = await Promise.all([
      canSeeBilling
        ? ctx.db.query("payments").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect()
        : Promise.resolve([]),
      ctx.db.query("cases").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
      canSeeClients
        ? ctx.db.query("clients").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect()
        : Promise.resolve([]),
      ctx.db.query("appointments").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
      ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect(),
      canSeeBilling
        ? ctx.db.query("bankTransactions").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect()
        : Promise.resolve([]),
    ]);

    const allCases = isAdmin ? allOrgCases : allOrgCases.filter((c) => c.assignedTo === userId);
    const allTasks = isAdmin ? allOrgTasks : allOrgTasks.filter((t) => t.assignedTo === userId);
    // Non-admins only see appointments they are involved in
    const scopedAppointments = isAdmin
      ? allAppointments
      : allAppointments.filter(
          (a) =>
            a.createdBy === userId ||
            a.assignedTo === userId ||
            (a.attendees ?? []).some((att: { userId?: string }) => att.userId === userId)
        );

    return buckets.map((b) => ({
      label: b.label,
      revenue: canSeeBilling
        ? (allPayments
            .filter((p) => p.status === "Completed" && p.paidAt >= b.start && p.paidAt <= b.end)
            .reduce((sum, p) => sum + p.amount, 0) +
          allBankTxns
            .filter((t) => t.type === "money_in" && t.date >= b.start && t.date <= b.end)
            .reduce((sum, t) => sum + t.amount, 0)) / 100
        : 0,
      cases: allCases.filter((c) => c._creationTime >= b.start && c._creationTime <= b.end).length,
      clients: canSeeClients
        ? allOrgClients.filter((c) => c._creationTime >= b.start && c._creationTime <= b.end).length
        : 0,
      appointments: scopedAppointments.filter((a) => a.startAt >= b.start && a.startAt <= b.end).length,
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

/**
 * Enriched task list for the non-admin dashboard task table.
 * - staff: only tasks assigned to them
 * - case_manager: tasks assigned to them + all tasks in cases they manage
 * - admin: all active org tasks (capped at 20)
 * Returns tasks with assignee name, case title, and an `isMine` flag.
 */
export const dashboardTasks = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const orgId = ctx.user.organisationId;
    const userId = ctx.user._id;
    const role = ctx.user.role;

    const allOrgTasks = await ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("organisationId", orgId))
      .collect();

    const activeTasks = allOrgTasks.filter(
      (t) => !t.hidden && t.status !== "Completed" && t.status !== "Rejected"
    );

    let scopedTasks: typeof activeTasks;

    if (role === "staff") {
      scopedTasks = activeTasks.filter((t) => t.assignedTo === userId);
    } else if (role === "case_manager") {
      const myCases = await ctx.db
        .query("cases")
        .withIndex("by_assigned", (q) => q.eq("assignedTo", userId))
        .collect();
      const myCaseIds = new Set(myCases.map((c) => c._id));
      scopedTasks = activeTasks.filter(
        (t) => t.assignedTo === userId || (t.caseId && myCaseIds.has(t.caseId))
      );
    } else {
      scopedTasks = activeTasks;
    }

    scopedTasks = scopedTasks
      .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity))
      .slice(0, 20);

    // Enrich with user names and case titles
    const uniqueUserIds = [
      ...new Set(scopedTasks.map((t) => t.assignedTo).filter((id): id is Id<"users"> => !!id)),
    ];
    const uniqueCaseIds = [
      ...new Set(scopedTasks.map((t) => t.caseId).filter((id): id is Id<"cases"> => !!id)),
    ];

    const [userDocs, caseDocs] = await Promise.all([
      Promise.all(uniqueUserIds.map((id) => ctx.db.get(id))),
      Promise.all(uniqueCaseIds.map((id) => ctx.db.get(id))),
    ]);

    const userMap = new Map(
      userDocs.filter((u): u is NonNullable<typeof u> => u !== null).map((u) => [u._id, u.fullName])
    );
    const caseMap = new Map(
      caseDocs.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => [c._id, c.title])
    );

    return scopedTasks.map((t) => ({
      _id: t._id,
      taskId: t.taskId,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ?? null,
      assigneeName: t.assignedTo ? (userMap.get(t.assignedTo) ?? null) : null,
      caseTitle: t.caseId ? (caseMap.get(t.caseId) ?? null) : null,
      isMine: t.assignedTo === userId,
    }));
  },
});
