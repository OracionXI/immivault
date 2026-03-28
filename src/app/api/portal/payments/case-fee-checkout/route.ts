import { NextRequest, NextResponse } from "next/server";
import { callPortalEndpoint } from "@/lib/portal-api";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, status } = await callPortalEndpoint("/portal/payments/case-fee-checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status });
}
