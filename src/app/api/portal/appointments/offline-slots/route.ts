import { NextRequest, NextResponse } from "next/server";
import { callPortalEndpoint } from "@/lib/portal-api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const { data, status } = await callPortalEndpoint(`/portal/appointments/offline-slots?${qs}`, {
    method: "GET",
  });
  return NextResponse.json(data, { status });
}
