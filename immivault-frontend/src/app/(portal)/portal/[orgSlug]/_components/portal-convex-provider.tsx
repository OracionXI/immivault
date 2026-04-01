"use client";

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";

// ── Singleton Convex client for the portal (separate from the main app client) ─

const portalClient = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!
);

// ── JWT context ───────────────────────────────────────────────────────────────

type JwtContextValue = {
  getToken: () => string | null;
  refresh: () => Promise<string | null>;
};

const PortalJwtContext = createContext<JwtContextValue | null>(null);

function usePortalConvexAuth() {
  const ctx = useContext(PortalJwtContext);
  const token = ctx?.getToken() ?? null;
  return {
    isLoading: false,
    isAuthenticated: !!token,
    fetchAccessToken: async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!ctx) return null;
      if (forceRefreshToken) return await ctx.refresh();
      return token;
    },
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * Wraps portal pages with a Convex client authenticated via the portal JWT.
 * `jwt` comes from the layout (minted server-side after verifying the session
 * cookie). When expired, Convex calls `fetchAccessToken({ forceRefreshToken: true })`
 * which re-fetches /api/portal/me and returns a fresh JWT.
 */
export function PortalConvexProvider({
  jwt,
  onRefresh,
  children,
}: {
  jwt: string | null;
  onRefresh: () => Promise<string | null>;
  children: ReactNode;
}) {
  // Keep a ref so the stable auth hook always reads the latest token
  const jwtRef = useRef(jwt);
  jwtRef.current = jwt;

  // Stable object reference — only recreated if onRefresh changes
  const ctx: JwtContextValue = useMemo(
    () => ({ getToken: () => jwtRef.current, refresh: onRefresh }),
    [onRefresh]
  );

  return (
    <PortalJwtContext.Provider value={ctx}>
      <ConvexProviderWithAuth client={portalClient} useAuth={usePortalConvexAuth}>
        {children}
      </ConvexProviderWithAuth>
    </PortalJwtContext.Provider>
  );
}
