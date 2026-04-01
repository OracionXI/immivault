import { NextRequest, NextResponse } from "next/server";
import { convexSiteUrl, buildSessionCookie } from "@/lib/portal-api";

/**
 * GET — email link landing.
 * We do NOT validate the token here. Email security scanners (Outlook Safe Links,
 * Apple Mail preview, Proton link proxy, antivirus, etc.) automatically follow GET
 * links in emails, which would burn the single-use token before the user clicks.
 * Instead, redirect to a confirmation page. The actual validation happens on POST
 * when the user clicks "Enter Portal".
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawToken = searchParams.get("token");
  const orgSlug = searchParams.get("org");

  if (!rawToken || !orgSlug) {
    return NextResponse.redirect(new URL(`/portal-error?reason=invalid_link`, req.url));
  }

  const params = new URLSearchParams({ token: rawToken, org: orgSlug });
  return NextResponse.redirect(new URL(`/portal-confirm?${params}`, req.url));
}

/**
 * POST — actual token validation (called from the confirmation page).
 * Crawlers don't POST, so the token is safe until the real user clicks the button.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; orgSlug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const { token: rawToken, orgSlug } = body;
  if (!rawToken || !orgSlug) {
    return NextResponse.json({ error: "Missing token or orgSlug." }, { status: 400 });
  }

  const baseUrl = convexSiteUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const res = await fetch(`${baseUrl}/portal/auth/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: rawToken, org: orgSlug }),
  });

  const data = await res.json().catch(() => ({ error: "Backend error" }));

  if (!res.ok || !data.sessionToken) {
    return NextResponse.json({ error: data.error ?? "Invalid or expired link." }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true, orgSlug: data.orgSlug },
    { headers: { "Set-Cookie": buildSessionCookie(data.sessionToken) } }
  );
}
