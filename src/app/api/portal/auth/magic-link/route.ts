import { NextRequest, NextResponse } from "next/server";
import { convexSiteUrl, buildSessionCookie } from "@/lib/portal-api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawToken = searchParams.get("token");
  const orgSlug = searchParams.get("org");

  if (!rawToken || !orgSlug) {
    return NextResponse.redirect(new URL(`/portal-error?reason=invalid_link`, req.url));
  }

  const baseUrl = convexSiteUrl();
  if (!baseUrl) {
    return NextResponse.redirect(new URL(`/portal-error?reason=config_error`, req.url));
  }

  const res = await fetch(
    `${baseUrl}/portal/auth/magic-link?token=${encodeURIComponent(rawToken)}&org=${encodeURIComponent(orgSlug)}`
  );

  const data = await res.json().catch(() => ({ error: "Backend error" }));

  if (!res.ok || !data.sessionToken) {
    const reason = encodeURIComponent(data.error ?? "invalid_link");
    return NextResponse.redirect(new URL(`/portal/${orgSlug}?error=${reason}`, req.url));
  }

  // Set session cookie and redirect to welcome (welcome page handles profile gate)
  const redirectUrl = new URL(`/portal/${data.orgSlug}/welcome`, req.url);
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Set-Cookie", buildSessionCookie(data.sessionToken));
  return response;
}
