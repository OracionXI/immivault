import { NextRequest, NextResponse } from "next/server";
import { convexSiteUrl } from "@/lib/portal-api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const baseUrl = convexSiteUrl();
  if (!baseUrl) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  const dateStr = req.nextUrl.searchParams.get("dateStr");
  if (!dateStr) return NextResponse.json({ error: "dateStr is required" }, { status: 400 });

  const url = `${baseUrl}/portal/public-admin-slots?orgSlug=${encodeURIComponent(orgSlug)}&dateStr=${encodeURIComponent(dateStr)}`;
  const res = await fetch(url);
  let data: unknown;
  try { data = await res.json(); } catch { data = { error: "Backend error" }; }
  return NextResponse.json(data, { status: res.status });
}
