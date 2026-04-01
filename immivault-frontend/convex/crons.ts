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

// Every 5 min — auto-transition appointment statuses: Upcoming→Ongoing→Expired
crons.interval(
  "appointment status transitions",
  { minutes: 5 },
  internal.appointments.mutations.transitionStatuses
);

// Every 30 min — expire prospect requests whose 48h payment window has passed
crons.interval(
  "expire unpaid prospect requests",
  { minutes: 30 },
  internal.appointmentRequests.mutations.expireUnpaid
);

// Daily at 03:00 UTC — hard-delete cancelled/expired appointments older than 40 days
crons.daily(
  "purge expired appointments",
  { hourUTC: 3, minuteUTC: 0 },
  internal.appointments.mutations.purgeExpired
);

// Daily at 09:00 UTC — nudge portal clients with incomplete profiles
crons.daily(
  "nudge incomplete portal profiles",
  { hourUTC: 9, minuteUTC: 0 },
  internal.portal.jobs.nudgeIncompleteProfiles
);

// Daily at 08:00 UTC — remind portal clients of upcoming case fee payment dates
crons.daily(
  "payment date reminders",
  { hourUTC: 8, minuteUTC: 0 },
  internal.portal.jobs.sendPaymentDateReminders
);

// Daily at 04:00 UTC — permanently delete S3 objects for documents soft-deleted 30+ days ago
crons.daily(
  "purge deleted documents from S3",
  { hourUTC: 4, minuteUTC: 0 },
  internal.documents.actions.purgeDeleted
);

export default crons;
