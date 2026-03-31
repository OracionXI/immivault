import { NextRequest, NextResponse } from "next/server";
import { convexSiteUrl } from "@/lib/portal-api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const baseUrl = convexSiteUrl();
  if (!baseUrl) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const res = await fetch(`${baseUrl}/portal/public-info?orgSlug=${encodeURIComponent(orgSlug)}`);
  let data: unknown;
  try { data = await res.json(); } catch { data = { error: "Backend error" }; }
  return NextResponse.json(data, { status: res.status });
}
