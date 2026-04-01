/**
 * Shared utility for portal Next.js API routes.
 * Handles session cookie reading and server-to-Convex HTTP forwarding.
 */

import { cookies } from "next/headers";
import { createHash } from "crypto";

export const PORTAL_COOKIE = "portal_session";

/** SHA-256 hash of a string → hex (Node.js crypto, used in API routes). */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** The Convex site URL (where HTTP actions are exposed). */
export function convexSiteUrl(): string {
  return process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
}

/**
 * Read the portal session cookie, hash it, and call the given Convex HTTP action.
 * Returns the response from Convex, or a 401 if the cookie is missing.
 */
export async function callPortalEndpoint(
  path: string,
  options?: RequestInit
): Promise<{ data: unknown; status: number }> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(PORTAL_COOKIE)?.value;
  if (!rawToken) return { data: { error: "Unauthorized" }, status: 401 };

  const sessionHash = hashToken(rawToken);
  const baseUrl = convexSiteUrl();
  if (!baseUrl) return { data: { error: "Server configuration error" }, status: 500 };

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      Authorization: `Bearer ${sessionHash}`,
      "Content-Type": "application/json",
    },
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = { error: "Invalid response from backend" };
  }

  return { data, status: res.status };
}

/** Build a Set-Cookie header for the portal session (30-day, httpOnly, Secure, SameSite=Strict). */
export function buildSessionCookie(rawToken: string): string {
  const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction ? "; Secure" : "";
  return `${PORTAL_COOKIE}=${rawToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

/** Build a cookie header that clears the session cookie. */
export function clearSessionCookie(): string {
  return `${PORTAL_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
