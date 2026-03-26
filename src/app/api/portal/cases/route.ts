import { NextResponse } from "next/server";
import { callPortalEndpoint } from "@/lib/portal-api";

export async function GET() {
  const { data, status } = await callPortalEndpoint("/portal/cases");
  return NextResponse.json(data, { status });
}
