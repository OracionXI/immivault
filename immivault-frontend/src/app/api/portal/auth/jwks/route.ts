import { getPortalJwks } from "@/lib/portal-jwt";
import { NextResponse } from "next/server";

/** Public key set — Convex uses this to verify portal JWTs. */
export async function GET() {
  const jwks = await getPortalJwks();
  return NextResponse.json(jwks, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
