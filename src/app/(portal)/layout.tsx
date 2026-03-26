// Portal layout — intentionally standalone (no Clerk, no ConvexProvider).
// Client auth is managed via httpOnly session cookies proxied through /api/portal/* routes.
export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
