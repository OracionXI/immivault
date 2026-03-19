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
    const isAdmin = ctx.user.role === "admin" || ctx.user.role === "accountant";
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

      const [overdueInvs, allOrgPayments] = await Promise.all([
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
      ]);
      overdueInvoices = overdueInvs.length;
      monthlyRevenue = allOrgPayments
        .filter((p) => p.status === "Completed" && p.paidAt >= monthStart.getTime())
        .reduce((sum, p) => sum + p.amount, 0) / 100;
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
  args: { months: v.optional(v.number()), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const orgId = ctx.user.organisationId;
    const userId = ctx.user._id;
    const isAdmin = ctx.user.role === "admin" || ctx.user.role === "accountant";
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

    const [allPayments, allOrgCases, allOrgClients, allAppointments, allOrgTasks] = await Promise.all([
      isAdmin
        ? ctx.db.query("payments").withIndex("by_org", (q) => q.eq("organisationId", orgId)).collect()
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
        ? allPayments
            .filter((p) => p.status === "Completed" && p.paidAt >= b.start && p.paidAt <= b.end)
            .reduce((sum, p) => sum + p.amount, 0) / 100
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
    const isAdmin = ctx.user.role === "admin" || ctx.user.role === "accountant";

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
