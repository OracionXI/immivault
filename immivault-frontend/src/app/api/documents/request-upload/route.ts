import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    clientId?: string;
    caseId?: string;
    filename?: string;
    mimeType?: string;
    fileSize?: number;
    visibility?: string;
    type?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.clientId || !body.filename || !body.mimeType || !body.fileSize || !body.visibility) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (body.visibility !== "internal" && body.visibility !== "client") {
    return NextResponse.json({ error: "visibility must be 'internal' or 'client'" }, { status: 400 });
  }

  try {
    convex.setAuth(token);
    const result = await convex.action(api.documents.actions.requestUpload, {
      clientId: body.clientId as any,
      caseId: body.caseId as any,
      filename: body.filename,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      visibility: body.visibility as "internal" | "client",
      type: body.type,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
