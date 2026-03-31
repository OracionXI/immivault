import { NextResponse } from "next/server";
import { callPortalEndpoint } from "@/lib/portal-api";

export async function POST() {
  const { data, status } = await callPortalEndpoint("/portal/notifications/read", {
    method: "POST",
  });
  return NextResponse.json(data, { status });
}
