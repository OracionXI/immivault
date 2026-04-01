import { NextRequest, NextResponse } from "next/server";
import { callPortalEndpoint } from "@/lib/portal-api";

export async function GET() {
  const { data, status } = await callPortalEndpoint("/portal/profile");
  return NextResponse.json(data, { status });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { data, status } = await callPortalEndpoint("/portal/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status });
}
