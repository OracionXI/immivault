import { NextRequest, NextResponse } from "next/server";
import { PORTAL_COOKIE, clearSessionCookie, hashToken, convexSiteUrl } from "@/lib/portal-api";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(PORTAL_COOKIE)?.value;

  // Fire-and-forget: invalidate the session server-side
  if (rawToken) {
    const sessionHash = hashToken(rawToken);
    const baseUrl = convexSiteUrl();
    if (baseUrl) {
      fetch(`${baseUrl}/portal/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionHash}` },
      }).catch(() => {}); // intentionally not awaited
    }
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
