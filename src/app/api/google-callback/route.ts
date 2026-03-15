import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Google OAuth 2.0 callback handler
// Flow:
//   1. User clicks "Connect Google Calendar" → opens popup to /api/google-start
//   2. /api/google-start redirects to Google's OAuth consent screen
//   3. Google redirects to this endpoint with ?code=...&state=<convexUserId>
//   4. We exchange the code for tokens, save the refresh token to Convex
//   5. We return an HTML page that closes the popup + signals success to parent
// ---------------------------------------------------------------------------

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // Clerk session token passed as state
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return new NextResponse(closePopupHtml("error", "Google authorization was denied or failed."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return new NextResponse(closePopupHtml("error", "Google OAuth is not configured on this server."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    // Exchange authorization code for access + refresh tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      console.error("Token exchange failed:", err);
      return new NextResponse(closePopupHtml("error", "Failed to exchange authorization code."), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const tokens = await tokenRes.json();
    const refreshToken: string = tokens.refresh_token;

    if (!refreshToken) {
      return new NextResponse(
        closePopupHtml("error", "No refresh token received. Please revoke app access in your Google account and try again."),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Get the user's Google email via userinfo endpoint
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = userInfoRes.ok ? await userInfoRes.json() : {};
    const googleEmail: string = userInfo.email ?? "";

    // Save tokens to Convex using the convexUserId passed in state
    // We use the HTTP client with the auth token from the state-encoded token
    // Note: state = convexUserId (the Convex _id of the user document)
    // We call an internal mutation via a server-side Convex client
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL not set");

    // The frontend passes the Clerk session token as the state parameter
    const token = state;

    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(token);

    await convex.mutation(api.users.mutations.saveGoogleTokens, {
      googleRefreshToken: refreshToken,
      googleEmail,
    });

    return new NextResponse(closePopupHtml("success", ""), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return new NextResponse(closePopupHtml("error", "An unexpected error occurred."), {
      headers: { "Content-Type": "text/html" },
    });
  }
}

function closePopupHtml(status: "success" | "error", message: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Google Calendar Authorization</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
  <div style="text-align:center;padding:32px;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:360px">
    ${status === "success"
      ? `<div style="color:#16a34a;font-size:48px">✓</div>
         <h2 style="color:#111;margin:16px 0 8px">Google Calendar Connected</h2>
         <p style="color:#6b7280">You can now create appointments with Google Meet links. This window will close shortly.</p>`
      : `<div style="color:#dc2626;font-size:48px">✗</div>
         <h2 style="color:#111;margin:16px 0 8px">Authorization Failed</h2>
         <p style="color:#6b7280">${message}</p>
         <button onclick="window.close()" style="margin-top:16px;padding:10px 24px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer">Close</button>`
    }
  </div>
  <script>
    if ("${status}" === "success") {
      // Signal the opener (ImmiVault settings page) that connection succeeded
      if (window.opener) {
        window.opener.postMessage("google-connected", "*");
      }
      setTimeout(() => window.close(), 2000);
    }
  </script>
</body>
</html>`;
}
