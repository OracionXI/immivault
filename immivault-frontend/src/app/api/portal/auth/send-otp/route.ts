import { NextRequest, NextResponse } from "next/server";
import { convexSiteUrl } from "@/lib/portal-api";

export async function POST(req: NextRequest) {
  let body: { email?: string; orgSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email, orgSlug } = body;
  if (!email || !orgSlug) {
    return NextResponse.json({ error: "Missing email or orgSlug" }, { status: 400 });
  }
  const emailTrimmed = email.trim();
  if (emailTrimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const baseUrl = convexSiteUrl();
  if (!baseUrl) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const res = await fetch(`${baseUrl}/portal/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.toLowerCase().trim(), orgSlug }),
  });

  const data = await res.json().catch(() => ({ error: "Backend error" }));
  return NextResponse.json(data, { status: res.status });
}
