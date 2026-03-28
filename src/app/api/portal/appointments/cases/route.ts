import { NextRequest, NextResponse } from "next/server";
import { callPortalEndpoint } from "@/lib/portal-api";

export async function GET(_req: NextRequest) {
  const { data, status } = await callPortalEndpoint("/portal/appointments/cases", {
    method: "GET",
  });
  return NextResponse.json(data, { status });
}
