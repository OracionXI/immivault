import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

// ---------------------------------------------------------------------------
// All email sending is internalAction — never on the public API.
// Called via ctx.scheduler.runAfter(0, ...) from mutations so they stay fast.
// Email is optional: if RESEND_API_KEY is not set, email is silently skipped.
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<h2 style="color:#1d4ed8">${escapeHtml(title)}</h2>
${body}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#6b7280">Ordena — Immigration Case Management</p>
</body></html>`;
}

async function sendEmailOptional(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // Resend not configured yet — skip silently

  const fromName = process.env.EMAIL_FROM_NAME ?? "Ordena";
  const fromAddr = process.env.EMAIL_FROM_ADDRESS ?? "noreply@ordena.app";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromAddr}>`,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend error ${res.status}: ${JSON.stringify(err)}`);
  }
}

// ─── Legacy email actions (kept for backward compatibility with existing crons) ─

export const sendCaseAssigned = internalAction({
  args: {
    assigneeEmail: v.string(),
    assigneeName: v.string(),
    caseTitle: v.string(),
    caseNumber: v.string(),
  },
  handler: async (_ctx, args) => {
    await sendEmailOptional(
      args.assigneeEmail,
      `New Case Assigned: ${args.caseTitle}`,
      renderHtml(
        "New Case Assigned",
        `<p>Hi ${escapeHtml(args.assigneeName)},</p>
         <p>You have been assigned to the following case:</p>
         <p><strong>${escapeHtml(args.caseTitle)}</strong> (${escapeHtml(args.caseNumber)})</p>
         <p>Log in to Ordena to review the case details and get started.</p>`
      )
    );
  },
});

export const sendInvoiceSent = internalAction({
  args: {
    clientEmail: v.string(),
    clientName: v.string(),
    invoiceNumber: v.string(),
    total: v.number(),
    dueDate: v.number(),
    paymentUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const fmtAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(args.total);
    const fmtDue = new Date(args.dueDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const payBtn = args.paymentUrl
      ? `<p><a href="${args.paymentUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Pay Now</a></p>`
      : "";

    await sendEmailOptional(
      args.clientEmail,
      `Invoice ${args.invoiceNumber} — ${fmtAmount} due ${fmtDue}`,
      renderHtml(
        `Invoice ${escapeHtml(args.invoiceNumber)}`,
        `<p>Dear ${escapeHtml(args.clientName)},</p>
         <p>An invoice for <strong>${fmtAmount}</strong> has been issued and is due by <strong>${fmtDue}</strong>.</p>
         ${payBtn}
         <p>If you have any questions, please contact your attorney.</p>`
      )
    );
  },
});

export const sendAppointmentReminder = internalAction({
  args: {
    recipientEmail: v.string(),
    recipientName: v.string(),
    appointmentTitle: v.string(),
    startAt: v.number(),
    location: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const fmtDate = new Date(args.startAt).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const locationLine = args.location
      ? `<p><strong>Location:</strong> ${escapeHtml(args.location)}</p>`
      : "";

    await sendEmailOptional(
      args.recipientEmail,
      `Reminder: ${args.appointmentTitle} — ${fmtDate}`,
      renderHtml(
        "Appointment Reminder",
        `<p>Hi ${escapeHtml(args.recipientName)},</p>
         <p>This is a reminder for your upcoming appointment:</p>
         <p><strong>${escapeHtml(args.appointmentTitle)}</strong></p>
         <p><strong>When:</strong> ${fmtDate}</p>
         ${locationLine}
         <p>Please ensure you arrive on time with all required documents.</p>`
      )
    );
  },
});

export const sendTaskDueReminder = internalAction({
  args: {
    assigneeEmail: v.string(),
    assigneeName: v.string(),
    taskTitle: v.string(),
    dueDate: v.number(),
  },
  handler: async (_ctx, args) => {
    const fmtDue = new Date(args.dueDate).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    await sendEmailOptional(
      args.assigneeEmail,
      `Task Due Tomorrow: ${args.taskTitle}`,
      renderHtml(
        "Task Due Reminder",
        `<p>Hi ${escapeHtml(args.assigneeName)},</p>
         <p>This is a reminder that the following task is due tomorrow:</p>
         <p><strong>${escapeHtml(args.taskTitle)}</strong></p>
         <p><strong>Due:</strong> ${fmtDue}</p>
         <p>Log in to Ordena to update the task status.</p>`
      )
    );
  },
});

// ─── New notification actions (in-app + email) ────────────────────────────────

/** Case created — notify all admins in the org except the creator. */
export const onCaseCreated = internalAction({
  args: { caseId: v.id("cases"), creatorId: v.id("users") },
  handler: async (ctx, args) => {
    const c = await ctx.runQuery(internal.cases.queries.getById, { id: args.caseId });
    if (!c) return;

    const admins = await ctx.runQuery(internal.users.queries.listAdminsByOrg, {
      organisationId: c.organisationId,
    });

    for (const admin of admins) {
      if (admin._id === args.creatorId) continue; // skip the creator
      await ctx.runMutation(internal.notifications.mutations.insert, {
        organisationId: c.organisationId,
        recipientId: admin._id,
        type: "case_created",
        title: "New case created",
        message: `Case ${c.caseNumber} — ${c.title} has been created`,
        entityType: "case",
        entityId: c._id,
      });
      await sendEmailOptional(
        admin.email,
        `New Case Created: ${c.title}`,
        renderHtml(
          "New Case Created",
          `<p>Hi ${escapeHtml(admin.fullName)},</p>
           <p>A new case has been created in your organisation:</p>
           <p><strong>${escapeHtml(c.title)}</strong> (${escapeHtml(c.caseNumber)})</p>
           <p>Log in to Ordena to review the case details.</p>`
        )
      );
    }
  },
});

/** Case assigned — notify the new assignee (skip if self-assigned). */
export const onCaseAssigned = internalAction({
  args: {
    caseId: v.id("cases"),
    newAssigneeId: v.id("users"),
    assignerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    if (args.newAssigneeId === args.assignerId) return;

    const c = await ctx.runQuery(internal.cases.queries.getById, { id: args.caseId });
    if (!c) return;
    const assignee = await ctx.runQuery(internal.users.queries.getById, { id: args.newAssigneeId });
    if (!assignee) return;

    await ctx.runMutation(internal.notifications.mutations.insert, {
      organisationId: c.organisationId,
      recipientId: args.newAssigneeId,
      type: "case_assigned",
      title: "New case assigned to you",
      message: `You've been assigned to case ${c.caseNumber} — ${c.title}`,
      entityType: "case",
      entityId: c._id,
    });
    await sendEmailOptional(
      assignee.email,
      `New Case Assigned: ${c.title}`,
      renderHtml(
        "New Case Assigned",
        `<p>Hi ${escapeHtml(assignee.fullName)},</p>
         <p>You have been assigned to the following case:</p>
         <p><strong>${escapeHtml(c.title)}</strong> (${escapeHtml(c.caseNumber)})</p>
         <p>Log in to Ordena to review the case details and get started.</p>`
      )
    );
  },
});

/** Case status changed — notify the case assignee (if not self) and all admins (if not self). */
export const onCaseStatusChanged = internalAction({
  args: {
    caseId: v.id("cases"),
    changedById: v.id("users"),
    newStatus: v.string(),
    excludeUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const c = await ctx.runQuery(internal.cases.queries.getById, { id: args.caseId });
    if (!c) return;

    const notified = new Set<string>([args.changedById]);
    if (args.excludeUserId) notified.add(args.excludeUserId);

    // Notify the assigned case manager (if they didn't make the change)
    if (c.assignedTo && !notified.has(c.assignedTo)) {
      notified.add(c.assignedTo);
      const assignee = await ctx.runQuery(internal.users.queries.getById, { id: c.assignedTo });
      if (assignee) {
        await ctx.runMutation(internal.notifications.mutations.insert, {
          organisationId: c.organisationId,
          recipientId: c.assignedTo,
          type: "case_status_changed",
          title: "Case status updated",
          message: `Case ${c.title} has been moved to ${args.newStatus}`,
          entityType: "case",
          entityId: c._id,
        });
        await sendEmailOptional(
          assignee.email,
          `Case Status Updated: ${c.title}`,
          renderHtml(
            "Case Status Updated",
            `<p>Hi ${escapeHtml(assignee.fullName)},</p>
             <p>The status of your case has been updated:</p>
             <p><strong>${escapeHtml(c.title)}</strong> (${escapeHtml(c.caseNumber)}) → <strong>${escapeHtml(args.newStatus)}</strong></p>
             <p>Log in to Ordena for more details.</p>`
          )
        );
      }
    }

    // Also notify all admins in the org who didn't make the change
    const admins = await ctx.runQuery(internal.users.queries.listAdminsByOrg, {
      organisationId: c.organisationId,
    });
    for (const admin of admins) {
      if (notified.has(admin._id)) continue;
      notified.add(admin._id);
      await ctx.runMutation(internal.notifications.mutations.insert, {
        organisationId: c.organisationId,
        recipientId: admin._id,
        type: "case_status_changed",
        title: "Case status updated",
        message: `Case ${c.title} has been moved to ${args.newStatus}`,
        entityType: "case",
        entityId: c._id,
      });
    }
  },
});

/** Case deadline approaching — notify the assignee and mark the case as notified. */
export const onCaseDeadline = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const c = await ctx.runQuery(internal.cases.queries.getById, { id: args.caseId });
    if (!c || !c.assignedTo || !c.deadline) return;

    const assignee = await ctx.runQuery(internal.users.queries.getById, { id: c.assignedTo });
    if (!assignee) return;

    const fmtDeadline = new Date(c.deadline).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    await ctx.runMutation(internal.notifications.mutations.insert, {
      organisationId: c.organisationId,
      recipientId: c.assignedTo,
      type: "case_deadline",
      title: "Case deadline approaching",
      message: `Case ${c.title} is due on ${fmtDeadline}`,
      entityType: "case",
      entityId: c._id,
    });
    await sendEmailOptional(
      assignee.email,
      `Deadline Approaching: ${c.title}`,
      renderHtml(
        "Case Deadline Approaching",
        `<p>Hi ${escapeHtml(assignee.fullName)},</p>
         <p>The following case has a deadline within the next 48 hours:</p>
         <p><strong>${escapeHtml(c.title)}</strong> (${escapeHtml(c.caseNumber)})</p>
         <p><strong>Deadline:</strong> ${fmtDeadline}</p>
         <p>Please ensure all required work is completed on time.</p>`
      )
    );

    // Mark as notified to prevent duplicate notifications
    await ctx.runMutation(internal.cases.mutations.setDeadlineNotified, { id: args.caseId });
  },
});

/** Task assigned — notify the new assignee (skip if self-assigned). */
export const onTaskAssigned = internalAction({
  args: {
    taskId: v.id("tasks"),
    newAssigneeId: v.id("users"),
    assignerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    if (args.newAssigneeId === args.assignerId) return;

    const task = await ctx.runQuery(internal.tasks.queries.getById, { id: args.taskId });
    if (!task) return;
    const assignee = await ctx.runQuery(internal.users.queries.getById, { id: args.newAssigneeId });
    if (!assignee) return;

    await ctx.runMutation(internal.notifications.mutations.insert, {
      organisationId: task.organisationId,
      recipientId: args.newAssigneeId,
      type: "task_assigned",
      title: "New task assigned to you",
      message: `You've been assigned task ${task.taskId} — ${task.title}`,
      entityType: "task",
      entityId: task._id,
    });
    await sendEmailOptional(
      assignee.email,
      `New Task Assigned: ${task.title}`,
      renderHtml(
        "New Task Assigned",
        `<p>Hi ${escapeHtml(assignee.fullName)},</p>
         <p>You have been assigned the following task:</p>
         <p><strong>${escapeHtml(task.title)}</strong> (${escapeHtml(task.taskId)})</p>
         <p>Log in to Ordena to view the task details.</p>`
      )
    );
  },
});

/** Task status changed — notify the assignee (if not self) and the parent case's manager (if not already notified). */
export const onTaskStatusChanged = internalAction({
  args: {
    taskId: v.id("tasks"),
    changedById: v.id("users"),
    newStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.tasks.queries.getById, { id: args.taskId });
    if (!task) return;

    const notified = new Set<string>([args.changedById]);

    // Notify the task assignee (if they didn't make the change)
    if (task.assignedTo && !notified.has(task.assignedTo)) {
      notified.add(task.assignedTo);
      const assignee = await ctx.runQuery(internal.users.queries.getById, { id: task.assignedTo });
      if (assignee) {
        await ctx.runMutation(internal.notifications.mutations.insert, {
          organisationId: task.organisationId,
          recipientId: task.assignedTo,
          type: "task_status_changed",
          title: "Task status updated",
          message: `Task ${task.title} has been moved to ${args.newStatus}`,
          entityType: "task",
          entityId: task._id,
        });
        await sendEmailOptional(
          assignee.email,
          `Task Status Updated: ${task.title}`,
          renderHtml(
            "Task Status Updated",
            `<p>Hi ${escapeHtml(assignee.fullName)},</p>
             <p>The status of your task has been updated:</p>
             <p><strong>${escapeHtml(task.title)}</strong> (${escapeHtml(task.taskId)}) → <strong>${escapeHtml(args.newStatus)}</strong></p>
             <p>Log in to Ordena for more details.</p>`
          )
        );
      }
    }

    // Also notify the parent case's assigned case manager (if not already notified)
    if (task.caseId) {
      const parentCase = await ctx.runQuery(internal.cases.queries.getById, { id: task.caseId });
      if (parentCase?.assignedTo && !notified.has(parentCase.assignedTo)) {
        notified.add(parentCase.assignedTo);
        const caseManager = await ctx.runQuery(internal.users.queries.getById, { id: parentCase.assignedTo });
        if (caseManager) {
          await ctx.runMutation(internal.notifications.mutations.insert, {
            organisationId: task.organisationId,
            recipientId: parentCase.assignedTo,
            type: "task_status_changed",
            title: "Task status updated",
            message: `Task ${task.title} in case ${parentCase.title} has been moved to ${args.newStatus}`,
            entityType: "task",
            entityId: task._id,
          });
        }
      }
    }
  },
});

/** Task overdue — notify the assignee. Called from markOverdueUrgent cron. */
export const onTaskOverdue = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.tasks.queries.getById, { id: args.taskId });
    if (!task || !task.assignedTo) return;

    const assignee = await ctx.runQuery(internal.users.queries.getById, { id: task.assignedTo });
    if (!assignee) return;

    const fmtDue = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : "unknown date";

    await ctx.runMutation(internal.notifications.mutations.insert, {
      organisationId: task.organisationId,
      recipientId: task.assignedTo,
      type: "task_overdue",
      title: "Task is overdue",
      message: `Task ${task.title} has passed its due date`,
      entityType: "task",
      entityId: task._id,
    });
    await sendEmailOptional(
      assignee.email,
      `Task Overdue: ${task.title}`,
      renderHtml(
        "Task Overdue",
        `<p>Hi ${escapeHtml(assignee.fullName)},</p>
         <p>The following task has passed its due date:</p>
         <p><strong>${escapeHtml(task.title)}</strong> (${escapeHtml(task.taskId)})</p>
         <p><strong>Was due:</strong> ${fmtDue}</p>
         <p>Please update the task status or contact your manager.</p>`
      )
    );
  },
});

/** Comment on a case or task — notify the assignee; also parse @mentions. */
export const onComment = internalAction({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.runQuery(internal.comments.queries.getById, { id: args.commentId });
    if (!comment) return;

    // Portal (client) comments have no authorId — skip staff notifications for them
    if (!comment.authorId) return;
    const commenter = await ctx.runQuery(internal.users.queries.getById, { id: comment.authorId });
    if (!commenter) return;

    // ── Notify entity assignee (case or task, never admin) ────────────────────
    let assigneeId: string | undefined;
    let entityOrgId: string | undefined;
    let entityName = "";

    if (comment.entityType === "case") {
      const c = await ctx.runQuery(internal.cases.queries.getById, {
        id: comment.entityId as Id<"cases">,
      });
      if (c) {
        assigneeId = c.assignedTo;
        entityOrgId = c.organisationId;
        entityName = c.title;
      }
    } else {
      const task = await ctx.runQuery(internal.tasks.queries.getById, {
        id: comment.entityId as Id<"tasks">,
      });
      if (task) {
        assigneeId = task.assignedTo;
        entityOrgId = task.organisationId;
        entityName = task.title;

        // Also notify the case manager of the linked case (if any, and not already the task assignee or commenter)
        if (task.caseId) {
          const linkedCase = await ctx.runQuery(internal.cases.queries.getById, {
            id: task.caseId,
          });
          if (
            linkedCase?.assignedTo &&
            linkedCase.assignedTo !== comment.authorId &&
            linkedCase.assignedTo !== task.assignedTo
          ) {
            const caseManager = await ctx.runQuery(internal.users.queries.getById, {
              id: linkedCase.assignedTo,
            });
            if (caseManager && caseManager.organisationId === linkedCase.organisationId) {
              const preview =
                comment.body.replace(/@\[([^\]]+)\]\((user|doc):[^)]+\)/g, "@$1").slice(0, 80) +
                (comment.body.length > 80 ? "…" : "");
              await ctx.runMutation(internal.notifications.mutations.insert, {
                organisationId: linkedCase.organisationId,
                recipientId: linkedCase.assignedTo,
                type: "comment",
                title: `New comment on task: ${task.title}`,
                message: `${commenter.fullName}: ${preview}`,
                entityType: "task",
                entityId: comment.entityId,
              });
              await sendEmailOptional(
                caseManager.email,
                `New Comment on Task: ${task.title}`,
                renderHtml(
                  "New Comment on Your Case's Task",
                  `<p>Hi ${escapeHtml(caseManager.fullName)},</p>
                   <p>${escapeHtml(commenter.fullName)} commented on a task in your case <strong>${escapeHtml(linkedCase.title)}</strong>:</p>
                   <blockquote style="border-left:3px solid #e5e7eb;margin:12px 0;padding:8px 16px;color:#374151">${escapeHtml(preview)}</blockquote>
                   <p>Log in to Ordena to view the full comment.</p>`
                )
              );
            }
          }
        }
      }
    }

    if (assigneeId && entityOrgId && assigneeId !== comment.authorId) {
      const assignee = await ctx.runQuery(internal.users.queries.getById, {
        id: assigneeId as Id<"users">,
      });
      // Never notify admins or accountants for case/task comments
      if (assignee && assignee.role !== "admin" && assignee.role !== "accountant") {
        const preview =
          comment.body.replace(/@\[([^\]]+)\]\((user|doc):[^)]+\)/g, "@$1").slice(0, 80) +
          (comment.body.length > 80 ? "…" : "");

        await ctx.runMutation(internal.notifications.mutations.insert, {
          organisationId: entityOrgId as Id<"organisations">,
          recipientId: assigneeId as Id<"users">,
          type: "comment",
          title: `New comment on ${comment.entityType === "case" ? "case" : "task"}: ${entityName}`,
          message: `${commenter.fullName}: ${preview}`,
          entityType: comment.entityType,
          entityId: comment.entityId,
        });
        await sendEmailOptional(
          assignee.email,
          `New Comment on ${entityName}`,
          renderHtml(
            "New Comment",
            `<p>Hi ${escapeHtml(assignee.fullName)},</p>
             <p>${escapeHtml(commenter.fullName)} commented on <strong>${escapeHtml(entityName)}</strong>:</p>
             <blockquote style="border-left:3px solid #e5e7eb;margin:12px 0;padding:8px 16px;color:#374151">${escapeHtml(preview)}</blockquote>
             <p>Log in to Ordena to view the full comment.</p>`
          )
        );
      }
    }

    // ── Parse @mentions and notify each mentioned user ────────────────────────
    const MENTION_RE = /@\[([^\]]+)\]\(user:([^)]+)\)/g;
    const notifiedIds = new Set<string>();
    if (assigneeId) notifiedIds.add(assigneeId); // don't double-notify the task assignee
    notifiedIds.add(comment.authorId); // don't self-notify commenter
    // Track the case manager we already notified above (task comments only)
    if (comment.entityType === "task") {
      const _task = await ctx.runQuery(internal.tasks.queries.getById, { id: comment.entityId as Id<"tasks"> });
      if (_task?.caseId) {
        const _case = await ctx.runQuery(internal.cases.queries.getById, { id: _task.caseId });
        if (_case?.assignedTo) notifiedIds.add(_case.assignedTo);
      }
    }

    let match: RegExpExecArray | null;
    while ((match = MENTION_RE.exec(comment.body)) !== null) {
      const [, , mentionedUserId] = match;
      if (notifiedIds.has(mentionedUserId)) continue;
      notifiedIds.add(mentionedUserId);

      const mentioned = await ctx.runQuery(internal.users.queries.getById, {
        id: mentionedUserId as Id<"users">,
      });
      if (!mentioned || !entityOrgId) continue;
      // Only notify users from the same organisation — prevents cross-org notification via crafted @mentions
      if (mentioned.organisationId !== entityOrgId) continue;
      if (mentioned.role === "accountant") continue; // accountants don't have case/task access

      await ctx.runMutation(internal.notifications.mutations.insert, {
        organisationId: entityOrgId as Id<"organisations">,
        recipientId: mentionedUserId as Id<"users">,
        type: "mention",
        title: "You were mentioned in a comment",
        message: `${commenter.fullName} mentioned you in ${entityName}`,
        entityType: comment.entityType,
        entityId: comment.entityId,
      });
      await sendEmailOptional(
        mentioned.email,
        `You were mentioned by ${commenter.fullName}`,
        renderHtml(
          "You Were Mentioned",
          `<p>Hi ${escapeHtml(mentioned.fullName)},</p>
           <p>${escapeHtml(commenter.fullName)} mentioned you in a comment on <strong>${escapeHtml(entityName)}</strong>.</p>
           <p>Log in to Ordena to view the comment.</p>`
        )
      );
    }
  },
});

/** Case updated — notify the assigned case manager + all admins (not all org members, to prevent info leak). */
export const onCaseUpdated = internalAction({
  args: { caseId: v.id("cases"), updatedById: v.id("users") },
  handler: async (ctx, args) => {
    const c = await ctx.runQuery(internal.cases.queries.getById, { id: args.caseId });
    if (!c) return;

    const updater = await ctx.runQuery(internal.users.queries.getById, { id: args.updatedById });
    const updaterName = updater?.fullName ?? "Someone";

    const notified = new Set<string>([args.updatedById]);

    // Notify the assigned case manager (if not the updater)
    if (c.assignedTo && !notified.has(c.assignedTo)) {
      notified.add(c.assignedTo);
      const assignee = await ctx.runQuery(internal.users.queries.getById, { id: c.assignedTo });
      if (assignee) {
        await ctx.runMutation(internal.notifications.mutations.insert, {
          organisationId: c.organisationId,
          recipientId: c.assignedTo,
          type: "case_updated",
          title: "Case updated",
          message: `${updaterName} updated case ${c.caseNumber} — ${c.title}`,
          entityType: "case",
          entityId: c._id,
        });
        await sendEmailOptional(
          assignee.email,
          `Case Updated: ${c.title}`,
          renderHtml(
            "Case Updated",
            `<p>Hi ${escapeHtml(assignee.fullName)},</p>
             <p>${escapeHtml(updaterName)} has made updates to the following case:</p>
             <p><strong>${escapeHtml(c.title)}</strong> (${escapeHtml(c.caseNumber)})</p>
             <p>Log in to Ordena to review the changes.</p>`
          )
        );
      }
    }

    // Notify admins (except the updater)
    const admins = await ctx.runQuery(internal.users.queries.listAdminsByOrg, {
      organisationId: c.organisationId,
    });
    for (const admin of admins) {
      if (notified.has(admin._id)) continue;
      notified.add(admin._id);
      await ctx.runMutation(internal.notifications.mutations.insert, {
        organisationId: c.organisationId,
        recipientId: admin._id,
        type: "case_updated",
        title: "Case updated",
        message: `${updaterName} updated case ${c.caseNumber} — ${c.title}`,
        entityType: "case",
        entityId: c._id,
      });
    }
  },
});

/** Task updated — notify the task assignee + parent case manager + admins (not all org members, to prevent info leak). */
export const onTaskUpdated = internalAction({
  args: { taskId: v.id("tasks"), updatedById: v.id("users") },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.tasks.queries.getById, { id: args.taskId });
    if (!task) return;

    const updater = await ctx.runQuery(internal.users.queries.getById, { id: args.updatedById });
    const updaterName = updater?.fullName ?? "Someone";

    const notified = new Set<string>([args.updatedById]);

    // Notify the task assignee (if not the updater)
    if (task.assignedTo && !notified.has(task.assignedTo)) {
      notified.add(task.assignedTo);
      const assignee = await ctx.runQuery(internal.users.queries.getById, { id: task.assignedTo });
      if (assignee) {
        await ctx.runMutation(internal.notifications.mutations.insert, {
          organisationId: task.organisationId,
          recipientId: task.assignedTo,
          type: "task_updated",
          title: "Task updated",
          message: `${updaterName} updated task ${task.taskId} — ${task.title}`,
          entityType: "task",
          entityId: task._id,
        });
        await sendEmailOptional(
          assignee.email,
          `Task Updated: ${task.title}`,
          renderHtml(
            "Task Updated",
            `<p>Hi ${escapeHtml(assignee.fullName)},</p>
             <p>${escapeHtml(updaterName)} has made updates to the following task:</p>
             <p><strong>${escapeHtml(task.title)}</strong> (${escapeHtml(task.taskId)})</p>
             <p>Log in to Ordena to review the changes.</p>`
          )
        );
      }
    }

    // Notify the parent case manager (if applicable and not already notified)
    if (task.caseId) {
      const parentCase = await ctx.runQuery(internal.cases.queries.getById, { id: task.caseId });
      if (parentCase?.assignedTo && !notified.has(parentCase.assignedTo)) {
        notified.add(parentCase.assignedTo);
        await ctx.runMutation(internal.notifications.mutations.insert, {
          organisationId: task.organisationId,
          recipientId: parentCase.assignedTo,
          type: "task_updated",
          title: "Task updated",
          message: `${updaterName} updated task ${task.taskId} — ${task.title} in case ${parentCase.title}`,
          entityType: "task",
          entityId: task._id,
        });
      }
    }

    // Notify admins (except the updater)
    const admins = await ctx.runQuery(internal.users.queries.listAdminsByOrg, {
      organisationId: task.organisationId,
    });
    for (const admin of admins) {
      if (notified.has(admin._id)) continue;
      notified.add(admin._id);
      await ctx.runMutation(internal.notifications.mutations.insert, {
        organisationId: task.organisationId,
        recipientId: admin._id,
        type: "task_updated",
        title: "Task updated",
        message: `${updaterName} updated task ${task.taskId} — ${task.title}`,
        entityType: "task",
        entityId: task._id,
      });
    }
  },
});

/** Document uploaded to a case — notify the case assignee (skip if uploader = assignee). */
export const onDocumentUploaded = internalAction({
  args: {
    documentId: v.id("documents"),
    uploaderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.runQuery(internal.documents.queries.getById, { id: args.documentId });
    if (!doc || !doc.caseId) return;

    const c = await ctx.runQuery(internal.cases.queries.getById, { id: doc.caseId });
    if (!c || !c.assignedTo) return;
    if (c.assignedTo === args.uploaderId) return; // uploader is the assignee — skip

    const assignee = await ctx.runQuery(internal.users.queries.getById, { id: c.assignedTo });
    if (!assignee) return;

    const uploader = await ctx.runQuery(internal.users.queries.getById, { id: args.uploaderId });
    const uploaderName = uploader?.fullName ?? "Someone";

    await ctx.runMutation(internal.notifications.mutations.insert, {
      organisationId: c.organisationId,
      recipientId: c.assignedTo,
      type: "document_uploaded",
      title: "New document uploaded",
      message: `${uploaderName} uploaded "${doc.name}" to case ${c.title}`,
      entityType: "case",
      entityId: c._id,
    });
    await sendEmailOptional(
      assignee.email,
      `New Document Uploaded: ${doc.name}`,
      renderHtml(
        "New Document Uploaded",
        `<p>Hi ${escapeHtml(assignee.fullName)},</p>
         <p>${escapeHtml(uploaderName)} uploaded a new document to your case:</p>
         <p><strong>${escapeHtml(doc.name)}</strong> on case <strong>${escapeHtml(c.title)}</strong> (${escapeHtml(c.caseNumber)})</p>
         <p>Log in to Ordena to view the document.</p>`
      )
    );
  },
});
