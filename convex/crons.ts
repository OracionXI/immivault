import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily at 07:00 UTC — remind assignees of tasks due tomorrow
crons.daily(
  "task due reminders",
  { hourUTC: 7, minuteUTC: 0 },
  internal.notifications.jobs.sendTaskReminders
);

// Daily at 00:00 UTC — flip overdue invoices
crons.daily(
  "mark overdue invoices",
  { hourUTC: 0, minuteUTC: 0 },
  internal.billing.jobs.markOverdueInvoices
);

// Daily at 02:00 UTC — archive Completed cases older than 40 days
crons.daily(
  "archive completed cases",
  { hourUTC: 2, minuteUTC: 0 },
  internal.archival.jobs.archiveCompletedCases
);

// Daily at 01:00 UTC — escalate overdue tasks to Urgent priority
crons.daily(
  "escalate overdue tasks",
  { hourUTC: 1, minuteUTC: 0 },
  internal.tasks.mutations.markOverdueUrgent
);

// Daily at 06:00 UTC — notify case assignees of deadlines within 48 hours
crons.daily(
  "case deadline reminders",
  { hourUTC: 6, minuteUTC: 0 },
  internal.notifications.jobs.sendCaseDeadlineReminders
);

export default crons;
