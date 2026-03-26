import { NextRequest, NextResponse } from "next/server";
import { callPortalEndpoint } from "@/lib/portal-api";

export async function GET(request: NextRequest) {
  const docId = request.nextUrl.searchParams.get("docId");
  if (!docId) return NextResponse.json({ error: "Missing docId" }, { status: 400 });
  const { data, status } = await callPortalEndpoint(`/portal/document-url?docId=${encodeURIComponent(docId)}`);
  return NextResponse.json(data, { status });
}
