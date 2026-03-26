import { NextRequest, NextResponse } from "next/server";
import { convexSiteUrl, buildSessionCookie } from "@/lib/portal-api";

export async function POST(req: NextRequest) {
  let body: { email?: string; orgSlug?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email, orgSlug, code } = body;
  if (!email || !orgSlug || !code) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const emailTrimmed = email.trim();
  if (emailTrimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const baseUrl = convexSiteUrl();
  if (!baseUrl) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const res = await fetch(`${baseUrl}/portal/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.toLowerCase().trim(), orgSlug, code: code.trim() }),
  });

  const data = await res.json().catch(() => ({ error: "Backend error" }));

  if (!res.ok || !data.sessionToken) {
    return NextResponse.json({ error: data.error ?? "Invalid code" }, { status: res.status });
  }

  // Set the session token as an httpOnly cookie; never expose it in the response body
  const response = NextResponse.json({ ok: true, orgSlug: data.orgSlug });
  response.headers.set("Set-Cookie", buildSessionCookie(data.sessionToken));
  return response;
}
