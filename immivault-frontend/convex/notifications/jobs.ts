import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const DAY_MS = 86_400_000;

/**
 * Scheduled daily at 07:00 UTC.
 * Sends a reminder email for every task due the next calendar day.
 */
export const sendTaskReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const tomorrowStart = new Date(now + DAY_MS);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(now + DAY_MS);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const tasks = await ctx.runQuery(internal.tasks.queries.listDueTomorrow, {
      start: tomorrowStart.getTime(),
      end: tomorrowEnd.getTime(),
    });

    for (const task of tasks) {
      if (!task.assigneeEmail || !task.dueDate) continue;
      await ctx.scheduler.runAfter(0, internal.notifications.actions.sendTaskDueReminder, {
        assigneeEmail: task.assigneeEmail,
        assigneeName: task.assigneeName,
        taskTitle: task.title,
        dueDate: task.dueDate,
      });
    }
  },
});

/**
 * Scheduled daily at 06:00 UTC.
 * Sends deadline-approaching notifications for cases due within the next 48 hours.
 */
export const sendCaseDeadlineReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const windowEnd = now + 2 * DAY_MS; // 48 hours from now

    const cases = await ctx.runQuery(internal.cases.queries.listApproachingDeadline, {
      start: now,
      end: windowEnd,
    });

    for (const c of cases) {
      await ctx.scheduler.runAfter(0, internal.notifications.actions.onCaseDeadline, {
        caseId: c._id,
      });
    }
  },
});
