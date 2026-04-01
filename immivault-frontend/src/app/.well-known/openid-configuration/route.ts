import { portalIssuer } from "@/lib/portal-jwt";

/** OIDC discovery document — Convex fetches this to find the JWKS endpoint. */
export async function GET() {
  const issuer = portalIssuer();
  return Response.json({
    issuer,
    jwks_uri: `${issuer}/api/portal/auth/jwks`,
  });
}
