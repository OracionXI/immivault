import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${fromName} <${fromAddr}>`, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Resend error ${res.status}:`, err);
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Return all portal-enabled clients who completed onboarding (or skipped it)
 * but still have at least one key field missing.
 */
export const findClientsWithIncompleteProfiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.db.query("clients").collect();
    return clients
      .filter(
        (c) =>
          c.portalEnabled === true &&
          c.profileCompleted === true &&
          (!c.mobilePhone || !c.dateOfBirth || !c.address)
      )
      .map((c) => ({
        _id: c._id,
        organisationId: c.organisationId,
        firstName: c.firstName,
        email: c.email,
      }));
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Delete any existing profile_incomplete notifications for a client, then insert
 * a fresh one. This ensures exactly one nudge notification exists at all times —
 * no pile-up, but the timestamp is refreshed daily so it stays at the top.
 */
export const upsertProfileIncompleteNotification = internalMutation({
  args: {
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("portalNotifications")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    for (const n of existing) {
      if (n.type === "profile_incomplete") {
        await ctx.db.delete(n._id);
      }
    }

    await ctx.db.insert("portalNotifications", {
      organisationId: args.organisationId,
      clientId: args.clientId,
      type: "profile_incomplete",
      title: "Complete your profile",
      message: "Your profile is missing some details. Keeping it up-to-date helps your attorney serve you better.",
      read: false,
    });
  },
});

// ─── Payment Reminders ────────────────────────────────────────────────────────

/**
 * Return all portal-enabled clients with a nextPaymentDate within the next
 * 10 days (inclusive of today). Used by the daily payment reminder cron.
 */
export const findClientsWithUpcomingPayments = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const tenDaysFromNow = now + 10 * 24 * 60 * 60_000;
    const clients = await ctx.db.query("clients").collect();
    return clients
      .filter(
        (c) =>
          c.portalEnabled === true &&
          c.status !== "Archived" &&
          c.nextPaymentDate !== undefined &&
          c.nextPaymentDate > now &&
          c.nextPaymentDate <= tenDaysFromNow
      )
      .map((c) => ({
        _id: c._id,
        organisationId: c.organisationId,
        firstName: c.firstName,
        email: c.email,
        nextPaymentDate: c.nextPaymentDate as number,
      }));
  },
});

/**
 * Daily cron: send an in-app portal notification + email nudge to every
 * portal client whose next payment date is within 10 days.
 */
export const sendPaymentDateReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.runQuery(
      internal.portal.jobs.findClientsWithUpcomingPayments,
      {}
    );

    for (const client of clients) {
      const org = await ctx.runQuery(internal.organisations.queries.getById, {
        id: client.organisationId,
      });
      if (!org || !org.portalEnabled || !org.portalSlug) continue;

      const dueDate = new Date(client.nextPaymentDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const daysUntil = Math.ceil((client.nextPaymentDate - Date.now()) / 86_400_000);
      const dayLabel = daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;

      // In-app notification
      await ctx.runMutation(internal.portal.jobs.upsertPaymentReminderNotification, {
        clientId: client._id,
        organisationId: client.organisationId,
        dueDate,
        dayLabel,
      });

      // Email nudge
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ordenacrm.com";
      const paymentsUrl = `${appUrl}/portal/${org.portalSlug}/payments`;

      await sendEmailOptional(
        client.email,
        `Payment reminder: due ${dueDate} — ${org.name}`,
        `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<h2 style="color:#1d4ed8">Payment Reminder</h2>
<p>Hi ${client.firstName},</p>
<p>This is a friendly reminder that your next payment to <strong>${org.name}</strong> is due <strong>${dueDate}</strong> (${dayLabel}).</p>
<p style="margin:24px 0">
  <a href="${paymentsUrl}"
     style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
    Make a Payment
  </a>
</p>
<p style="font-size:12px;color:#6b7280">Or copy this link: ${paymentsUrl}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#6b7280">${org.name} — Powered by Ordena</p>
</body></html>`
      );
    }
  },
});

/**
 * Upsert a payment_reminder portal notification — replaces any existing one
 * so the client only ever has one active reminder (timestamp refreshed daily).
 */
export const upsertPaymentReminderNotification = internalMutation({
  args: {
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
    dueDate: v.string(),
    dayLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("portalNotifications")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    for (const n of existing) {
      if (n.type === "payment_reminder") {
        await ctx.db.delete(n._id);
      }
    }

    await ctx.db.insert("portalNotifications", {
      organisationId: args.organisationId,
      clientId: args.clientId,
      type: "payment_reminder",
      title: "Payment due soon",
      message: `Your next payment is due ${args.dueDate} (${args.dayLabel}). Tap to make a payment now.`,
      read: false,
    });
  },
});

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Daily cron: send an in-app portal notification + email nudge to every
 * portal client whose profile is still missing key fields.
 */
export const nudgeIncompleteProfiles = internalAction({
  args: {},
  handler: async (ctx) => {
    const clients = await ctx.runQuery(
      internal.portal.jobs.findClientsWithIncompleteProfiles,
      {}
    );

    for (const client of clients) {
      const org = await ctx.runQuery(internal.organisations.queries.getById, {
        id: client.organisationId,
      });
      if (!org || !org.portalEnabled || !org.portalSlug) continue;

      // Upsert in-app portal notification (replaces previous nudge)
      await ctx.runMutation(internal.portal.jobs.upsertProfileIncompleteNotification, {
        clientId: client._id,
        organisationId: client.organisationId,
      });

      // Email nudge
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ordenacrm.com";
      const profileUrl = `${appUrl}/portal/${org.portalSlug}/profile`;

      await sendEmailOptional(
        client.email,
        `Action needed: Complete your ${org.name} portal profile`,
        `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<h2 style="color:#1d4ed8">Complete Your Profile</h2>
<p>Hi ${client.firstName},</p>
<p>Your <strong>${org.name}</strong> client portal profile is still missing some details.
Keeping it up-to-date helps your attorney prepare your case more effectively.</p>
<p style="margin:24px 0">
  <a href="${profileUrl}"
     style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
    Complete My Profile
  </a>
</p>
<p style="font-size:12px;color:#6b7280">Or copy this link: ${profileUrl}</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#6b7280">${org.name} — Powered by Ordena</p>
</body></html>`
      );
    }
  },
});
