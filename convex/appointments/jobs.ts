import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Appointment notification jobs — fired via ctx.scheduler from mutations.
// Internal attendees get in-app + email; external/clients get email only.
// ---------------------------------------------------------------------------

function renderHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<h2 style="color:#1d4ed8">${title}</h2>
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
  if (!apiKey) return;

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
    console.error(`Resend error ${res.status}:`, err);
  }
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Appointment created — notify all internal attendees (except the creator). */
export const notifyCreated = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    creatorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.runQuery(internal.appointments.queries.getById, {
      id: args.appointmentId,
    });
    if (!appt) return;

    const creator = await ctx.runQuery(internal.users.queries.getById, {
      id: args.creatorId,
    });
    const creatorName = creator?.fullName ?? "Someone";
    const fmtDate = formatDateTime(appt.startAt);

    const meetLine = appt.googleMeetLink
      ? `<p><a href="${appt.googleMeetLink}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Join Google Meet</a></p>`
      : "";

    // Notify internal attendees (in-app + email)
    for (const att of appt.attendees ?? []) {
      if (att.type !== "internal" || !att.userId) continue;
      if (att.userId === args.creatorId) continue; // skip creator

      const attendee = await ctx.runQuery(internal.users.queries.getById, {
        id: att.userId,
      });
      if (!attendee) continue;

      await ctx.runMutation(internal.notifications.mutations.insert, {
        organisationId: appt.organisationId,
        recipientId: att.userId,
        type: "appointment_created",
        title: "New appointment scheduled",
        message: `${creatorName} scheduled "${appt.title}" on ${fmtDate}`,
        entityType: "appointment",
        entityId: appt._id,
      });

      await sendEmailOptional(
        attendee.email,
        `New Appointment: ${appt.title}`,
        renderHtml(
          "New Appointment Scheduled",
          `<p>Hi ${attendee.fullName},</p>
           <p>${creatorName} has scheduled a new appointment with you:</p>
           <p><strong>${appt.title}</strong></p>
           <p><strong>When:</strong> ${fmtDate}</p>
           ${meetLine}
           <p>Log in to Ordena to view the details.</p>`
        )
      );
    }

    // Email external attendees (no app access)
    for (const att of appt.attendees ?? []) {
      if (att.type !== "external") continue;

      await sendEmailOptional(
        att.email,
        `Appointment Scheduled: ${appt.title}`,
        renderHtml(
          "Appointment Scheduled",
          `<p>Hi ${att.name},</p>
           <p>An appointment has been scheduled for you:</p>
           <p><strong>${appt.title}</strong></p>
           <p><strong>When:</strong> ${fmtDate}</p>
           ${meetLine}
           <p>Please contact us if you have any questions.</p>`
        )
      );
    }
  },
});

/** Appointment updated — notify all attendees (except the updater). */
export const notifyUpdated = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    updatedById: v.id("users"),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.runQuery(internal.appointments.queries.getById, {
      id: args.appointmentId,
    });
    if (!appt) return;

    const updater = await ctx.runQuery(internal.users.queries.getById, {
      id: args.updatedById,
    });
    const updaterName = updater?.fullName ?? "Someone";
    const fmtDate = formatDateTime(appt.startAt);

    const meetLine = appt.googleMeetLink
      ? `<p><a href="${appt.googleMeetLink}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Join Google Meet</a></p>`
      : "";

    for (const att of appt.attendees ?? []) {
      if (att.type === "internal" && att.userId) {
        if (att.userId === args.updatedById) continue;

        const attendee = await ctx.runQuery(internal.users.queries.getById, {
          id: att.userId,
        });
        if (!attendee) continue;

        await ctx.runMutation(internal.notifications.mutations.insert, {
          organisationId: appt.organisationId,
          recipientId: att.userId,
          type: "appointment_updated",
          title: "Appointment updated",
          message: `${updaterName} updated "${appt.title}"`,
          entityType: "appointment",
          entityId: appt._id,
        });

        await sendEmailOptional(
          attendee.email,
          `Appointment Updated: ${appt.title}`,
          renderHtml(
            "Appointment Updated",
            `<p>Hi ${attendee.fullName},</p>
             <p>${updaterName} has updated the following appointment:</p>
             <p><strong>${appt.title}</strong></p>
             <p><strong>New date/time:</strong> ${fmtDate}</p>
             ${meetLine}
             <p>Log in to Ordena to view the updated details.</p>`
          )
        );
      } else if (att.type === "external") {
        await sendEmailOptional(
          att.email,
          `Appointment Updated: ${appt.title}`,
          renderHtml(
            "Appointment Updated",
            `<p>Hi ${att.name},</p>
             <p>Your appointment has been updated:</p>
             <p><strong>${appt.title}</strong></p>
             <p><strong>New date/time:</strong> ${fmtDate}</p>
             ${meetLine}
             <p>Please contact us if you have any questions.</p>`
          )
        );
      }
    }
  },
});

/** Appointment cancelled — notify all attendees (except the canceller). */
export const notifyCancelled = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    cancelledById: v.id("users"),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.runQuery(internal.appointments.queries.getById, {
      id: args.appointmentId,
    });
    if (!appt) return;

    const canceller = await ctx.runQuery(internal.users.queries.getById, {
      id: args.cancelledById,
    });
    const cancellerName = canceller?.fullName ?? "Someone";

    for (const att of appt.attendees ?? []) {
      if (att.type === "internal" && att.userId) {
        if (att.userId === args.cancelledById) continue;

        const attendee = await ctx.runQuery(internal.users.queries.getById, {
          id: att.userId,
        });
        if (!attendee) continue;

        await ctx.runMutation(internal.notifications.mutations.insert, {
          organisationId: appt.organisationId,
          recipientId: att.userId,
          type: "appointment_cancelled",
          title: "Appointment cancelled",
          message: `${cancellerName} cancelled "${appt.title}"`,
          entityType: "appointment",
          entityId: appt._id,
        });

        await sendEmailOptional(
          attendee.email,
          `Appointment Cancelled: ${appt.title}`,
          renderHtml(
            "Appointment Cancelled",
            `<p>Hi ${attendee.fullName},</p>
             <p>${cancellerName} has cancelled the following appointment:</p>
             <p><strong>${appt.title}</strong></p>
             <p>Please contact us if you need to reschedule.</p>`
          )
        );
      } else if (att.type === "external") {
        await sendEmailOptional(
          att.email,
          `Appointment Cancelled: ${appt.title}`,
          renderHtml(
            "Appointment Cancelled",
            `<p>Hi ${att.name},</p>
             <p>The following appointment has been cancelled:</p>
             <p><strong>${appt.title}</strong></p>
             <p>Please contact us if you need to reschedule.</p>`
          )
        );
      }
    }
  },
});
