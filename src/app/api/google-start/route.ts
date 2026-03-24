import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Initiates the Google OAuth flow.
// Called when user clicks "Connect Google Calendar" in settings.
// Accepts ?token=<clerk_session_token> in the query string.
//
// Security model:
//   - A cryptographically random nonce is generated server-side.
//   - The nonce is set as `state` in the OAuth URL (binds callback to this request).
//   - The Clerk token is stored in a short-lived HttpOnly cookie alongside the
//     nonce — it is NEVER exposed in the OAuth redirect URL.
//   - The callback verifies state === cookie.nonce before trusting the token.
//   - HttpOnly + SameSite=Lax prevents CSRF and JS-based cookie theft.
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.json(
      { error: "Missing session token." },
      { status: 400 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Google OAuth is not configured on this server." },
      { status: 500 }
    );
  }

  // Generate a cryptographically random nonce to bind this OAuth session.
  const nonce = crypto.randomUUID().replace(/-/g, "");

  // Encode nonce + token together in the cookie value (base64).
  // The cookie is HttpOnly so it cannot be read by client-side JS.
  const cookiePayload = Buffer.from(JSON.stringify({ nonce, token })).toString("base64");
  const isProduction = process.env.NODE_ENV === "production";
  const securFlag = isProduction ? "; Secure" : "";
  const cookieHeader = `_goauth_state=${cookiePayload}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${securFlag}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",   // required to get a refresh token
    prompt: "consent",        // always prompt so we always get a refresh token
    state: nonce,             // only the nonce — token is in the cookie
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`, {
    headers: { "Set-Cookie": cookieHeader },
  });
}
