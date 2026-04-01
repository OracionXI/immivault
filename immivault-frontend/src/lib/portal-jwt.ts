/**
 * Portal JWT utilities — RS256 signing for Convex custom auth.
 *
 * In production set:
 *   PORTAL_JWT_PRIVATE_KEY = base64(PKCS8 PEM)
 *   PORTAL_JWT_PUBLIC_KEY  = base64(SPKI  PEM)
 *
 * In development, a key pair is auto-generated on first use and cached
 * for the process lifetime. Users are re-authenticated on server restart,
 * which is acceptable in dev.
 *
 * The `sub` claim encodes clientId and orgId in a parseable format
 * so liveQueries can extract them via identity.subject (a guaranteed
 * standard OIDC field), avoiding reliance on custom claim access.
 */

import {
  generateKeyPair,
  importPKCS8,
  importSPKI,
  SignJWT,
  exportJWK,
} from "jose";

type KeyLike = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

const ALG = "RS256";

export function portalIssuer(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Build the `sub` claim encoding both IDs in a stable parseable format. */
export function buildPortalSub(clientId: string, orgId: string): string {
  return `portal|${clientId}|${orgId}`;
}

/** Parse clientId and orgId back out of a `sub` claim. Returns null if format is wrong. */
export function parsePortalSub(
  subject: string
): { clientId: string; orgId: string } | null {
  const parts = subject.split("|");
  if (parts.length !== 3 || parts[0] !== "portal") return null;
  return { clientId: parts[1], orgId: parts[2] };
}

// ── Key cache ─────────────────────────────────────────────────────────────────

let _privateKey: KeyLike | null = null;
let _publicKey: KeyLike | null = null;
let _publicJwk: Record<string, unknown> | null = null;
let _kid: string | null = null;
let _initPromise: Promise<void> | null = null;

async function init() {
  const privB64 = process.env.PORTAL_JWT_PRIVATE_KEY;
  const pubB64 = process.env.PORTAL_JWT_PUBLIC_KEY;

  if (privB64 && pubB64) {
    const privPem = Buffer.from(privB64, "base64").toString("utf8");
    const pubPem = Buffer.from(pubB64, "base64").toString("utf8");
    _privateKey = await importPKCS8(privPem, ALG);
    _publicKey = await importSPKI(pubPem, ALG);
  } else {
    const { privateKey, publicKey } = await generateKeyPair(ALG, {
      modulusLength: 2048,
    });
    _privateKey = privateKey;
    _publicKey = publicKey;
  }

  _publicJwk = (await exportJWK(_publicKey)) as Record<string, unknown>;
  const keyBytes = new TextEncoder().encode(JSON.stringify(_publicJwk));
  const hash = await crypto.subtle.digest("SHA-256", keyBytes);
  _kid = Buffer.from(hash).toString("base64url").slice(0, 16);
}

async function ensureKeys() {
  if (!_initPromise) _initPromise = init();
  await _initPromise;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type PortalTokenPayload = {
  sessionId: string;
  clientId: string;
  orgId: string;
};

/** Sign a 1-hour portal JWT for use by the Convex React client. */
export async function signPortalToken(payload: PortalTokenPayload): Promise<string> {
  await ensureKeys();
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG, kid: _kid! })
    .setSubject(buildPortalSub(payload.clientId, payload.orgId))
    .setIssuer(portalIssuer())
    .setAudience("convex")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(_privateKey!);
}

/** Return the JWKS payload for the /.well-known route. */
export async function getPortalJwks(): Promise<{ keys: unknown[] }> {
  await ensureKeys();
  return {
    keys: [{ ..._publicJwk!, alg: ALG, use: "sig", kid: _kid! }],
  };
}
