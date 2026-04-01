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

// ─── Prospect request outcome emails ─────────────────────────────────────────

/** Sent to a prospect when their appointment request is confirmed by an admin. */
export const sendProspectConfirmation = internalAction({
  args: {
    clientEmail: v.string(),
    clientFirstName: v.string(),
    orgName: v.string(),
    founderName: v.optional(v.string()),
    appointmentType: v.string(),
    preferredDate: v.string(),
    preferredTime: v.string(),
    clientTimezone: v.optional(v.string()),
    meetingMode: v.string(), // "online" | "in_person"
    meetLink: v.optional(v.string()),
    payUrl: v.optional(v.string()),
    paymentDeadline: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    // Format date: "2026-04-02" → "Wednesday, April 2, 2026"
    const dateObj = new Date(`${args.preferredDate}T12:00:00`);
    const formattedDate = isNaN(dateObj.getTime())
      ? args.preferredDate
      : dateObj.toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });

    // Format time: "14:30" → "2:30 PM"
    const timeParts = args.preferredTime.split(":");
    const h = parseInt(timeParts[0] ?? "0", 10);
    const m = parseInt(timeParts[1] ?? "0", 10);
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    const formattedTime = (!isNaN(h) && !isNaN(m))
      ? `${hour12}:${String(m).padStart(2, "0")} ${ampm}`
      : args.preferredTime;
    const tzNote = args.clientTimezone
      ? ` <span style="color:#94a3b8;font-size:12px;">(${escapeHtml(args.clientTimezone)})</span>`
      : "";

    const isOnline = args.meetingMode === "online";
    const hasMeetLink = isOnline && !!args.meetLink;

    const meetingRow = isOnline
      ? hasMeetLink
        ? `<tr>
            <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;width:120px;vertical-align:top;padding-right:16px;">Format</td>
            <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;">Online Meeting</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#64748b;font-size:13px;vertical-align:top;padding-right:16px;">Join Link</td>
            <td style="padding:10px 0;font-size:14px;">
              <a href="${escapeHtml(args.meetLink!)}" style="color:#1d4ed8;font-weight:600;text-decoration:none;word-break:break-all;">${escapeHtml(args.meetLink!)}</a>
            </td>
          </tr>`
        : `<tr>
            <td style="padding:10px 0;color:#64748b;font-size:13px;vertical-align:top;padding-right:16px;">Format</td>
            <td style="padding:10px 0;font-size:14px;color:#0f172a;font-weight:600;">Online Meeting</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#64748b;font-size:13px;vertical-align:top;padding-right:16px;">Join Link</td>
            <td style="padding:10px 0;font-size:14px;color:#64748b;font-style:italic;">You'll receive your meeting link before the appointment</td>
          </tr>`
      : `<tr>
          <td style="padding:10px 0;color:#64748b;font-size:13px;vertical-align:top;padding-right:16px;">Format</td>
          <td style="padding:10px 0;font-size:14px;color:#0f172a;font-weight:600;">In-Person</td>
        </tr>`;

    const contextNote = isOnline
      ? hasMeetLink
        ? `<div style="margin:24px 0 0;padding:14px 18px;background:#eff6ff;border-left:3px solid #3b82f6;border-radius:0 8px 8px 0;">
            <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.65;">
              The meeting link above is unique to your appointment. No account or software download is required —
              simply click the link at your scheduled time to join.
            </p>
          </div>`
        : `<div style="margin:24px 0 0;padding:14px 18px;background:#eff6ff;border-left:3px solid #3b82f6;border-radius:0 8px 8px 0;">
            <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.65;">
              This is an online video meeting. Your unique Google Meet link will be sent to you before your appointment — no software download required.
            </p>
          </div>`
      : `<div style="margin:24px 0 0;padding:14px 18px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:13px;color:#166534;line-height:1.65;">
            Our team will reach out to you prior to your appointment to confirm the meeting location and
            any documents you may wish to bring along.
          </p>
        </div>`;

    const signingName = args.founderName
      ? escapeHtml(args.founderName)
      : `The Team at ${escapeHtml(args.orgName)}`;

    const isPaid = !!args.payUrl;

    // Payment deadline formatted as "Thursday, April 3 at 2:30 PM"
    let deadlineNote = "";
    if (isPaid && args.paymentDeadline) {
      const dl = new Date(args.paymentDeadline);
      const dlFormatted = dl.toLocaleString("en-US", {
        weekday: "long", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      });
      deadlineNote = `<p style="margin:10px 0 0;font-size:12px;color:#b45309;">
        Payment must be completed by <strong>${escapeHtml(dlFormatted)}</strong> to secure your slot.
        After this deadline, the appointment will be released.
      </p>`;
    }

    const paymentSection = isPaid
      ? `<div style="margin:28px 0 0;padding:24px 26px;background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#92400e;letter-spacing:0.1em;text-transform:uppercase;">Payment Required</p>
          <p style="margin:0 0 20px;font-size:14px;color:#78350f;line-height:1.65;">
            To finalise your booking, please complete your payment using the secure link below.
            Your appointment will be activated as soon as payment is received.
          </p>
          <a href="${escapeHtml(args.payUrl!)}" style="display:inline-block;padding:14px 32px;background:#1e40af;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
            Complete Payment →
          </a>
          ${deadlineNote}
        </div>`
      : "";

    const headerTitle = isPaid ? "Appointment Reserved" : "Appointment Confirmed";
    const headerIcon = isPaid ? "⏳" : "✓";
    const introParagraph = isPaid
      ? `<p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.75;">
          Thank you for your interest. Your
          <strong style="color:#1e40af;">${escapeHtml(args.appointmentType)}</strong> appointment
          with <strong style="color:#0f172a;">${escapeHtml(args.orgName)}</strong> has been
          <strong>reserved</strong>. To officially confirm your slot, please complete
          the payment using the button below.
        </p>`
      : `<p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.75;">
          We are pleased to inform you that your
          <strong style="color:#1e40af;">${escapeHtml(args.appointmentType)}</strong> appointment
          with <strong style="color:#0f172a;">${escapeHtml(args.orgName)}</strong> has been
          officially confirmed. We genuinely look forward to meeting with you and are fully committed
          to providing you with an exceptional experience.
        </p>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${headerTitle}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;">

        <!-- Header banner -->
        <tr><td style="background:linear-gradient(135deg,#1e40af 0%,#4f46e5 100%);border-radius:14px 14px 0 0;padding:40px 48px 36px;text-align:center;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td align="center" style="padding-bottom:18px;">
              <div style="display:inline-block;width:52px;height:52px;background:rgba(255,255,255,0.2);border-radius:50%;text-align:center;line-height:52px;">
                <span style="color:white;font-size:24px;font-weight:700;">${headerIcon}</span>
              </div>
            </td></tr>
            <tr><td align="center">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">${headerTitle}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;font-weight:400;">${escapeHtml(args.orgName)}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Main content -->
        <tr><td style="background:#ffffff;padding:40px 48px;">

          <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#0f172a;">Dear ${escapeHtml(args.clientFirstName)},</p>

          ${introParagraph}

          <!-- Details card -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:22px 26px;margin:0 0 8px;">
            <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Your Appointment Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding:10px 16px 10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;width:110px;white-space:nowrap;vertical-align:top;">Date</td>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(formattedDate)}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px 10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;vertical-align:top;">Time</td>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;">${formattedTime}${tzNote}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px 10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;vertical-align:top;">Type</td>
                <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:500;">${escapeHtml(args.appointmentType)}</td>
              </tr>
              ${meetingRow}
            </table>
          </div>

          ${contextNote}

          ${paymentSection}

          <p style="margin:28px 0 0;font-size:14px;color:#475569;line-height:1.75;">
            If you need to reschedule or have any questions prior to your appointment, please do not
            hesitate to reply to this email. We are always happy to assist.
          </p>

          <!-- Founder sign-off -->
          <div style="margin:36px 0 0;padding:28px 0 0;border-top:1px solid #f1f5f9;">
            <p style="margin:0 0 6px;font-size:14px;color:#475569;">Warm regards,</p>
            <p style="margin:0 0 3px;font-size:16px;font-weight:700;color:#0f172a;">${signingName}</p>
            <p style="margin:0;font-size:13px;color:#94a3b8;">${escapeHtml(args.orgName)}</p>
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:22px 48px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7;">
            This confirmation was sent on behalf of <strong style="color:#64748b;">${escapeHtml(args.orgName)}</strong>
            via <strong style="color:#64748b;">Ordena</strong>.<br/>
            If you received this email in error, please disregard it.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const subject = isPaid
      ? `Action Required: Complete Payment to Confirm Your Appointment with ${args.orgName}`
      : `Your ${args.appointmentType} with ${args.orgName} is Confirmed`;

    await sendEmailOptional(args.clientEmail, subject, html);
  },
});

/** Sent to a prospect when their appointment request is rejected by an admin. */
export const sendProspectRejection = internalAction({
  args: {
    clientEmail: v.string(),
    clientFirstName: v.string(),
    orgName: v.string(),
    appointmentType: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const reasonBlock = args.reason
      ? `<p><strong>Reason:</strong> ${escapeHtml(args.reason)}</p>`
      : "";

    await sendEmailOptional(
      args.clientEmail,
      `Update on your appointment request with ${args.orgName}`,
      renderHtml(
        "Appointment Request Update",
        `<p>Hi ${escapeHtml(args.clientFirstName)},</p>
         <p>Thank you for reaching out to <strong>${escapeHtml(args.orgName)}</strong>.</p>
         <p>Unfortunately, we are unable to confirm your <strong>${escapeHtml(args.appointmentType)}</strong> appointment request at this time.</p>
         ${reasonBlock}
         <p>Please feel free to contact our office directly if you would like to discuss alternative arrangements or have any questions.</p>`
      )
    );
  },
});

/** Sent to a prospect when their 7-day payment window expires and the appointment is cancelled. */
export const sendProspectPaymentExpired = internalAction({
  args: {
    clientEmail: v.string(),
    clientFirstName: v.string(),
    orgName: v.string(),
    appointmentType: v.string(),
    preferredDate: v.string(),
  },
  handler: async (_ctx, args) => {
    const dateObj = new Date(`${args.preferredDate}T12:00:00`);
    const formattedDate = isNaN(dateObj.getTime())
      ? args.preferredDate
      : dateObj.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    await sendEmailOptional(
      args.clientEmail,
      `Your appointment with ${escapeHtml(args.orgName)} has been cancelled`,
      renderHtml(
        "Appointment Cancelled",
        `<p>Hi ${escapeHtml(args.clientFirstName)},</p>
         <p>Thank you for your interest in <strong>${escapeHtml(args.orgName)}</strong>.</p>
         <p>Unfortunately, your <strong>${escapeHtml(args.appointmentType)}</strong> appointment
         reserved for <strong>${escapeHtml(formattedDate)}</strong> has been
         <strong>cancelled</strong> because payment was not completed within the 7-day window.</p>
         <p>If you would still like to book a consultation, please visit our booking page to submit a new request. We would be happy to assist you.</p>
         <p>Please feel free to contact our office directly if you have any questions.</p>`
      )
    );
  },
});
