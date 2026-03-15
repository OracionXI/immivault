import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Initiates the Google OAuth flow.
// Called when user clicks "Connect Google Calendar" in settings.
// Accepts ?token=<clerk_session_token> in the query string.
// The token is passed through as part of the state so the callback can
// authenticate the Convex mutation that saves the refresh token.
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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Google OAuth is not configured on this server." },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",   // required to get a refresh token
    prompt: "consent",        // always prompt so we always get a refresh token
    state: token,             // pass session token through so callback can auth Convex
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
