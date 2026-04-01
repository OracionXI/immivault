import { NextRequest, NextResponse } from "next/server";
import { callPortalEndpoint } from "@/lib/portal-api";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { data, status } = await callPortalEndpoint("/portal/cases/comment", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status });
}
