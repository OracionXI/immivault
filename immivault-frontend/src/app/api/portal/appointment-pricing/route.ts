import { NextResponse } from "next/server";
import { callPortalEndpoint } from "@/lib/portal-api";

export async function GET() {
  const { data, status } = await callPortalEndpoint("/portal/appointment-pricing");
  return NextResponse.json(data, { status });
}
