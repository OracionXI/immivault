import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// All email sending is internalAction — never on the public API.
// Called via ctx.scheduler.runAfter(0, ...) from mutations so they stay fast.
// Email is optional: if RESEND_API_KEY is not set, email is silently skipped.
// ---------------------------------------------------------------------------

function renderHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<h2 style="color:#1d4ed8">${title}</h2>
${body}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#6b7280">ImmiVault — Immigration Case Management</p>
</body></html>`;
}

async function sendEmailOptional(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // Resend not configured yet — skip silently

  const fromName = process.env.EMAIL_FROM_NAME ?? "ImmiVault";
  const fromAddr = process.env.EMAIL_FROM_ADDRESS ?? "noreply@immivault.app";

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
        `<p>Hi ${args.assigneeName},</p>
         <p>You have been assigned to the following case:</p>
         <p><strong>${args.caseTitle}</strong> (${args.caseNumber})</p>
         <p>Log in to ImmiVault to review the case details and get started.</p>`
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
        `Invoice ${args.invoiceNumber}`,
        `<p>Dear ${args.clientName},</p>
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
      ? `<p><strong>Location:</strong> ${args.location}</p>`
      : "";

    await sendEmailOptional(
      args.recipientEmail,
      `Reminder: ${args.appointmentTitle} — ${fmtDate}`,
      renderHtml(
        "Appointment Reminder",
        `<p>Hi ${args.recipientName},</p>
         <p>This is a reminder for your upcoming appointment:</p>
         <p><strong>${args.appointmentTitle}</strong></p>
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
        `<p>Hi ${args.assigneeName},</p>
         <p>This is a reminder that the following task is due tomorrow:</p>
         <p><strong>${args.taskTitle}</strong></p>
         <p><strong>Due:</strong> ${fmtDue}</p>
         <p>Log in to ImmiVault to update the task status.</p>`
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
          `<p>Hi ${admin.fullName},</p>
           <p>A new case has been created in your organisation:</p>
           <p><strong>${c.title}</strong> (${c.caseNumber})</p>
           <p>Log in to ImmiVault to review the case details.</p>`
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
        `<p>Hi ${assignee.fullName},</p>
         <p>You have been assigned to the following case:</p>
         <p><strong>${c.title}</strong> (${c.caseNumber})</p>
         <p>Log in to ImmiVault to review the case details and get started.</p>`
      )
    );
  },
});

/** Case status changed — notify the case assignee (skip if changer = assignee). */
export const onCaseStatusChanged = internalAction({
  args: {
    caseId: v.id("cases"),
    changedById: v.id("users"),
    newStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const c = await ctx.runQuery(internal.cases.queries.getById, { id: args.caseId });
    if (!c || !c.assignedTo) return;
    if (c.assignedTo === args.changedById) return; // self-change — skip

    const assignee = await ctx.runQuery(internal.users.queries.getById, { id: c.assignedTo });
    if (!assignee) return;

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
        `<p>Hi ${assignee.fullName},</p>
         <p>The status of your case has been updated:</p>
         <p><strong>${c.title}</strong> (${c.caseNumber}) → <strong>${args.newStatus}</strong></p>
         <p>Log in to ImmiVault for more details.</p>`
      )
    );
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
        `<p>Hi ${assignee.fullName},</p>
         <p>The following case has a deadline within the next 48 hours:</p>
         <p><strong>${c.title}</strong> (${c.caseNumber})</p>
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
        `<p>Hi ${assignee.fullName},</p>
         <p>You have been assigned the following task:</p>
         <p><strong>${task.title}</strong> (${task.taskId})</p>
         <p>Log in to ImmiVault to view the task details.</p>`
      )
    );
  },
});

/** Task status changed by someone else — notify the assignee. */
export const onTaskStatusChanged = internalAction({
  args: {
    taskId: v.id("tasks"),
    changedById: v.id("users"),
    newStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(internal.tasks.queries.getById, { id: args.taskId });
    if (!task || !task.assignedTo) return;
    if (task.assignedTo === args.changedById) return; // self-change — skip

    const assignee = await ctx.runQuery(internal.users.queries.getById, { id: task.assignedTo });
    if (!assignee) return;

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
        `<p>Hi ${assignee.fullName},</p>
         <p>The status of your task has been updated:</p>
         <p><strong>${task.title}</strong> (${task.taskId}) → <strong>${args.newStatus}</strong></p>
         <p>Log in to ImmiVault for more details.</p>`
      )
    );
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
        `<p>Hi ${assignee.fullName},</p>
         <p>The following task has passed its due date:</p>
         <p><strong>${task.title}</strong> (${task.taskId})</p>
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

    const commenter = await ctx.runQuery(internal.users.queries.getById, { id: comment.authorId });
    if (!commenter) return;

    // ── Notify entity assignee (case or task, never admin) ────────────────────
    let assigneeId: string | undefined;
    let entityOrgId: string | undefined;
    let entityName = "";

    if (comment.entityType === "case") {
      const c = await ctx.runQuery(internal.cases.queries.getById, {
        id: comment.entityId as any,
      });
      if (c) {
        assigneeId = c.assignedTo;
        entityOrgId = c.organisationId;
        entityName = c.title;
      }
    } else {
      const task = await ctx.runQuery(internal.tasks.queries.getById, {
        id: comment.entityId as any,
      });
      if (task) {
        assigneeId = task.assignedTo;
        entityOrgId = task.organisationId;
        entityName = task.title;
      }
    }

    if (assigneeId && entityOrgId && assigneeId !== comment.authorId) {
      const assignee = await ctx.runQuery(internal.users.queries.getById, {
        id: assigneeId as any,
      });
      // Never notify admins for comments
      if (assignee && assignee.role !== "admin") {
        const preview =
          comment.body.replace(/@\[([^\]]+)\]\((user|doc):[^)]+\)/g, "@$1").slice(0, 80) +
          (comment.body.length > 80 ? "…" : "");

        await ctx.runMutation(internal.notifications.mutations.insert, {
          organisationId: entityOrgId as any,
          recipientId: assigneeId as any,
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
            `<p>Hi ${assignee.fullName},</p>
             <p>${commenter.fullName} commented on <strong>${entityName}</strong>:</p>
             <blockquote style="border-left:3px solid #e5e7eb;margin:12px 0;padding:8px 16px;color:#374151">${preview}</blockquote>
             <p>Log in to ImmiVault to view the full comment.</p>`
          )
        );
      }
    }

    // ── Parse @mentions and notify each mentioned user ────────────────────────
    const MENTION_RE = /@\[([^\]]+)\]\(user:([^)]+)\)/g;
    const notifiedIds = new Set<string>();
    if (assigneeId) notifiedIds.add(assigneeId); // don't double-notify the assignee
    notifiedIds.add(comment.authorId); // don't self-notify commenter

    let match: RegExpExecArray | null;
    while ((match = MENTION_RE.exec(comment.body)) !== null) {
      const [, , mentionedUserId] = match;
      if (notifiedIds.has(mentionedUserId)) continue;
      notifiedIds.add(mentionedUserId);

      const mentioned = await ctx.runQuery(internal.users.queries.getById, {
        id: mentionedUserId as any,
      });
      if (!mentioned || !entityOrgId) continue;

      await ctx.runMutation(internal.notifications.mutations.insert, {
        organisationId: entityOrgId as any,
        recipientId: mentionedUserId as any,
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
          `<p>Hi ${mentioned.fullName},</p>
           <p>${commenter.fullName} mentioned you in a comment on <strong>${entityName}</strong>.</p>
           <p>Log in to ImmiVault to view the comment.</p>`
        )
      );
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
        `<p>Hi ${assignee.fullName},</p>
         <p>${uploaderName} uploaded a new document to your case:</p>
         <p><strong>${doc.name}</strong> on case <strong>${c.title}</strong> (${c.caseNumber})</p>
         <p>Log in to ImmiVault to view the document.</p>`
      )
    );
  },
});
