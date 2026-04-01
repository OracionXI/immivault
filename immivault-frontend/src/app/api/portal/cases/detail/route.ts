import { NextRequest, NextResponse } from "next/server";
import { callPortalEndpoint } from "@/lib/portal-api";

export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
  const { data, status } = await callPortalEndpoint(`/portal/cases/detail?caseId=${encodeURIComponent(caseId)}`);
  return NextResponse.json(data, { status });
}
