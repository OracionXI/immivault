import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { requireEnv } from "../env";

// ---------------------------------------------------------------------------
// All email sending is internalAction — never on the public API.
// Called via ctx.scheduler.runAfter(0, ...) from mutations so they stay fast.
// ---------------------------------------------------------------------------

function renderHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<h2 style="color:#1d4ed8">${title}</h2>
${body}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#6b7280">ImmiVault — Immigration Case Management</p>
</body></html>`;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const apiKey = requireEnv("RESEND_API_KEY");
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

// ─── Case Assigned ─────────────────────────────────────────────────────────

export const sendCaseAssigned = internalAction({
  args: {
    assigneeEmail: v.string(),
    assigneeName: v.string(),
    caseTitle: v.string(),
    caseNumber: v.string(),
  },
  handler: async (_ctx, args) => {
    await sendEmail(
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

// ─── Invoice Sent ──────────────────────────────────────────────────────────

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
    // Amounts are stored as plain dollar values (not cents) in the invoices table.
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

    await sendEmail(
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

// ─── Appointment Reminder ──────────────────────────────────────────────────

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

    await sendEmail(
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

// ─── Task Due Reminder ─────────────────────────────────────────────────────

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

    await sendEmail(
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
