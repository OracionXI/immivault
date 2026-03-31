import { NextRequest, NextResponse } from "next/server";
import { convexSiteUrl } from "@/lib/portal-api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> }
) {
  const { orgSlug } = await params;
  const baseUrl = convexSiteUrl();
  if (!baseUrl) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const res = await fetch(`${baseUrl}/portal/prospect-pay-init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, orgSlug }),
  });
  let data: unknown;
  try { data = await res.json(); } catch { data = { error: "Backend error" }; }
  return NextResponse.json(data, { status: res.status });
}
