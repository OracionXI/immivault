import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v, ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";

// ─── Crypto Helpers ───────────────────────────────────────────────────────────

/** SHA-256 hash → hex string (Web Crypto, available in Convex actions) */
async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cryptographically random hex string of `byteLength` bytes. */
function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(byteLength)));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Random 6-digit OTP. */
function randomOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(new ArrayBuffer(4)))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

// ─── Email helper (Resend) ────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silently skip if not configured
  const fromName = process.env.EMAIL_FROM_NAME ?? "Ordena";
  const fromAddr = process.env.EMAIL_FROM_ADDRESS ?? "noreply@ordena.app";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${fromName} <${fromAddr}>`, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend error ${res.status}: ${JSON.stringify(err)}`);
  }
}

function renderPortalEmail(title: string, body: string, orgName: string): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<h2 style="color:#1d4ed8">${title}</h2>
${body}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#6b7280">${orgName} — Powered by Ordena</p>
</body></html>`;
}

// ─── OTP: Send ────────────────────────────────────────────────────────────────

/** Look up client by email within an org (internal query, reused by auth actions). */
export const findClientByEmail = internalQuery({
  args: { email: v.string(), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();
    return clients.find(
      (c) => c.email.toLowerCase() === args.email.toLowerCase() && c.portalEnabled === true
    ) ?? null;
  },
});

/** Look up org by its portalSlug (internal query). */
export const findOrgByPortalSlug = internalQuery({
  args: { portalSlug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organisations")
      .withIndex("by_portal_slug", (q) => q.eq("portalSlug", args.portalSlug))
      .unique();
  },
});

/** Store a new OTP record (internal mutation). */
export const storeOtp = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    codeHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Invalidate any previous unused OTPs for this client
    const existing = await ctx.db
      .query("portalOtpCodes")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    for (const otp of existing) {
      if (!otp.usedAt) await ctx.db.delete(otp._id);
    }
    await ctx.db.insert("portalOtpCodes", { ...args, attempts: 0 });
  },
});

/** Send OTP to a client email. Returns "ok" or throws. */
export const sendOtp = internalAction({
  args: { email: v.string(), orgSlug: v.string() },
  handler: async (ctx, args) => {
    // 1. Resolve org
    const org = await ctx.runQuery(internal.portal.auth.findOrgByPortalSlug, {
      portalSlug: args.orgSlug,
    });
    if (!org || !org.portalEnabled) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Portal not found or not enabled." });
    }

    // 2. Find client
    const client = await ctx.runQuery(internal.portal.auth.findClientByEmail, {
      email: args.email,
      organisationId: org._id,
    });
    if (!client) {
      // Return generic success to prevent email enumeration
      return { ok: true };
    }

    // 3. Rate limit: max 3 OTPs per hour per client (via OTP count in last hour)
    const oneHourAgo = Date.now() - 3_600_000;
    const recentOtps = await ctx.runQuery(internal.portal.auth.countRecentOtps, {
      clientId: client._id,
      since: oneHourAgo,
    });
    if (recentOtps >= 3) {
      throw new ConvexError({ code: "RATE_LIMITED", message: "Too many OTP requests. Try again in an hour." });
    }

    // 4. Generate OTP and hash it
    const code = randomOtp();
    const codeHash = await sha256Hex(code);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // 5. Store hash (never the raw code)
    await ctx.runMutation(internal.portal.auth.storeOtp, {
      organisationId: org._id,
      clientId: client._id,
      codeHash,
      expiresAt,
    });

    // 6. Send email
    await sendEmail(
      args.email,
      `Your ${org.name} portal login code`,
      renderPortalEmail(
        "Your One-Time Login Code",
        `<p>Hi ${client.firstName},</p>
         <p>Your login code for the <strong>${org.name}</strong> client portal is:</p>
         <p style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1d4ed8;margin:24px 0">${code}</p>
         <p>This code expires in <strong>10 minutes</strong> and can only be used once.</p>
         <p>If you did not request this code, you can safely ignore this email.</p>`,
        org.name
      )
    );

    return { ok: true };
  },
});

/** Count recent OTPs for rate limiting. */
export const countRecentOtps = internalQuery({
  args: { clientId: v.id("clients"), since: v.number() },
  handler: async (ctx, args) => {
    const otps = await ctx.db
      .query("portalOtpCodes")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    return otps.filter((o) => o._creationTime >= args.since).length;
  },
});

// ─── OTP: Verify ─────────────────────────────────────────────────────────────

/** Verify an OTP, create a session, return the raw session token. */
export const verifyOtp = internalAction({
  args: { email: v.string(), orgSlug: v.string(), code: v.string() },
  handler: async (ctx, args): Promise<{ sessionToken: string; clientId: string }> => {
    const org = await ctx.runQuery(internal.portal.auth.findOrgByPortalSlug, {
      portalSlug: args.orgSlug,
    });
    if (!org || !org.portalEnabled) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Portal not found." });
    }

    const client = await ctx.runQuery(internal.portal.auth.findClientByEmail, {
      email: args.email,
      organisationId: org._id,
    });
    if (!client) {
      throw new ConvexError({ code: "INVALID_CODE", message: "Invalid code." });
    }

    const trimmedCode = args.code.trim();
    if (!trimmedCode) {
      throw new ConvexError({ code: "INVALID_CODE", message: "Invalid code." });
    }
    const codeHash = await sha256Hex(trimmedCode);
    const result = await ctx.runMutation(internal.portal.auth.consumeOtp, {
      clientId: client._id,
      codeHash,
    });

    if (!result.ok) {
      throw new ConvexError({ code: "INVALID_CODE", message: result.reason ?? "Invalid or expired code." });
    }

    // Create session
    const rawToken = randomHex(32); // 256-bit token
    const sessionHash = await sha256Hex(rawToken);
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    await ctx.runMutation(internal.portal.auth.createSession, {
      organisationId: org._id,
      clientId: client._id,
      sessionHash,
      expiresAt,
    });

    // Update last login
    await ctx.runMutation(internal.portal.auth.updateLastLogin, { clientId: client._id });

    return { sessionToken: rawToken, clientId: client._id };
  },
});

/** Consume an OTP (validate hash, increment attempts, mark used). */
export const consumeOtp = internalMutation({
  args: { clientId: v.id("clients"), codeHash: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; reason?: string }> => {
    const otps = await ctx.db
      .query("portalOtpCodes")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Find latest valid (unused, not expired) OTP
    const now = Date.now();
    const valid = otps
      .filter((o) => !o.usedAt && o.expiresAt > now)
      .sort((a, b) => b._creationTime - a._creationTime)[0];

    if (!valid) return { ok: false, reason: "Code expired or already used." };
    if (valid.attempts >= 5) return { ok: false, reason: "Too many failed attempts. Request a new code." };

    if (valid.codeHash !== args.codeHash) {
      await ctx.db.patch(valid._id, { attempts: valid.attempts + 1 });
      return { ok: false, reason: "Invalid code." };
    }

    await ctx.db.patch(valid._id, { usedAt: now });
    return { ok: true };
  },
});

/** Persist a new portal session. */
export const createSession = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    sessionHash: v.string(),
    expiresAt: v.number(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("portalSessions", {
      ...args,
      lastSeenAt: Date.now(),
    });
  },
});

/** Update client's lastPortalLogin timestamp. */
export const updateLastLogin = internalMutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.clientId, { lastPortalLogin: Date.now() });
  },
});

// ─── Session: Verify ──────────────────────────────────────────────────────────

/** Verify a session hash, return session + client info. Used on every authenticated portal request. */
export const verifySession = internalQuery({
  args: { sessionHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("portalSessions")
      .withIndex("by_session_hash", (q) => q.eq("sessionHash", args.sessionHash))
      .unique();

    const now = Date.now();
    if (!session || session.expiresAt < now) return null;
    // Idle timeout: sessions unused for 7 days are treated as expired
    const IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
    if (now - session.lastSeenAt > IDLE_TIMEOUT_MS) return null;

    const client = await ctx.db.get(session.clientId);
    if (!client || client.organisationId !== session.organisationId) return null;
    if (!client.portalEnabled) return null;

    const org = await ctx.db.get(session.organisationId);
    if (!org || !org.portalEnabled) return null;

    return {
      sessionId: session._id,
      clientId: client._id,
      organisationId: session.organisationId,
      profileCompleted: client.profileCompleted ?? false,
      client: {
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
      },
      org: {
        name: org.name,
        portalSlug: org.portalSlug,
      },
    };
  },
});

/** Update the lastSeenAt of a session (called after every verified request). */
export const touchSession = internalMutation({
  args: { sessionId: v.id("portalSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastSeenAt: Date.now() });
  },
});

/** Delete a session (logout). */
export const deleteSession = internalMutation({
  args: { sessionHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("portalSessions")
      .withIndex("by_session_hash", (q) => q.eq("sessionHash", args.sessionHash))
      .unique();
    if (session) await ctx.db.delete(session._id);
  },
});

// ─── Magic Link: Send (Invite) ────────────────────────────────────────────────

/** Store a new magic link (internal mutation). */
export const storeMagicLink = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Invalidate old unused magic links for this client
    const existing = await ctx.db
      .query("portalMagicLinks")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    for (const ml of existing) {
      if (!ml.usedAt) await ctx.db.delete(ml._id);
    }
    await ctx.db.insert("portalMagicLinks", args);
  },
});

/** Send a portal invite (magic link) to a client. Called after client is created. */
export const sendInvite = internalAction({
  args: {
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args) => {
    const org = await ctx.runQuery(internal.organisations.queries.getById, {
      id: args.organisationId,
    });
    if (!org || !org.portalEnabled || !org.portalSlug) return;

    const client = await ctx.runQuery(internal.portal.queries.getClientById, {
      clientId: args.clientId,
      organisationId: args.organisationId,
    });
    if (!client || !client.portalEnabled) return;

    const rawToken = randomHex(32); // 256-bit token
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = Date.now() + 72 * 60 * 60 * 1000; // 72 hours

    await ctx.runMutation(internal.portal.auth.storeMagicLink, {
      organisationId: org._id,
      clientId: client._id,
      tokenHash,
      expiresAt,
    });

    const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    // The magic link goes to the Next.js app, not the Convex site
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ordenacrm.com";
    const magicLink = `${appUrl}/api/portal/auth/magic-link?token=${rawToken}&org=${org.portalSlug}`;

    await sendEmail(
      client.email,
      `You've been invited to ${org.name}'s client portal`,
      renderPortalEmail(
        `Welcome to the ${org.name} Client Portal`,
        `<p>Hi ${client.firstName},</p>
         <p>You've been invited to access your case information through the <strong>${org.name}</strong> client portal.</p>
         <p>Click the button below to set up your access. This link expires in 72 hours.</p>
         <p style="margin:24px 0">
           <a href="${magicLink}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Access Your Portal</a>
         </p>
         <p style="font-size:12px;color:#6b7280">Or copy this link: ${magicLink}</p>
         <p>After accessing the portal, you can log in anytime using your email and a one-time code.</p>`,
        org.name
      )
    );
  },
});

// ─── Magic Link: Validate ─────────────────────────────────────────────────────

/** Validate a magic link token, create a session, return raw session token. */
export const validateMagicLink = internalAction({
  args: { rawToken: v.string(), orgSlug: v.string() },
  handler: async (ctx, args): Promise<{ sessionToken: string; clientId: string; orgSlug: string }> => {
    const org = await ctx.runQuery(internal.portal.auth.findOrgByPortalSlug, {
      portalSlug: args.orgSlug,
    });
    if (!org || !org.portalEnabled) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Portal not found." });
    }

    const tokenHash = await sha256Hex(args.rawToken);
    const result = await ctx.runMutation(internal.portal.auth.consumeMagicLink, {
      tokenHash,
      organisationId: org._id,
    });

    if (!result.ok || !result.clientId) {
      throw new ConvexError({ code: "INVALID_LINK", message: result.reason ?? "Invalid or expired link." });
    }

    // Create session
    const rawSessionToken = randomHex(32);
    const sessionHash = await sha256Hex(rawSessionToken);
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    await ctx.runMutation(internal.portal.auth.createSession, {
      organisationId: org._id,
      clientId: result.clientId as Id<"clients">,
      sessionHash,
      expiresAt,
    });

    await ctx.runMutation(internal.portal.auth.updateLastLogin, { clientId: result.clientId as Id<"clients"> });

    return { sessionToken: rawSessionToken, clientId: result.clientId, orgSlug: org.portalSlug! };
  },
});

/** Consume a magic link (validate, mark used). */
export const consumeMagicLink = internalMutation({
  args: { tokenHash: v.string(), organisationId: v.id("organisations") },
  handler: async (ctx, args): Promise<{ ok: boolean; clientId?: string; reason?: string }> => {
    const link = await ctx.db
      .query("portalMagicLinks")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (!link) return { ok: false, reason: "Link not found." };
    if (link.organisationId !== args.organisationId) return { ok: false, reason: "Link not found." };
    if (link.usedAt) return { ok: false, reason: "Link already used. Please request a new one." };
    if (link.expiresAt < Date.now()) return { ok: false, reason: "Link has expired. Please request a new one." };

    await ctx.db.patch(link._id, { usedAt: Date.now() });
    return { ok: true, clientId: link.clientId };
  },
});
