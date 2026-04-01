"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: React.ReactNode }) {
  // When env vars are not yet configured (e.g. Vercel deploy without secrets),
  // skip the Clerk/Convex providers so the build does not crash at prerender time.
  // This matches the current dummy-auth mode where providers are not active anyway.
  if (!convex) return <>{children}</>;

  return (
    <ClerkProvider
      appearance={{
        elements: {
          card: {
            backgroundColor: "transparent",
            boxShadow: "none",
            border: "none",
          },
          headerTitle: {
            color: "var(--auth-fg-4)",
            fontSize: "1.375rem",
            fontWeight: "600",
            letterSpacing: "-0.025em"
          },
          headerSubtitle: {
            color: "var(--auth-fg-3)",
            fontSize: "0.875rem",
            marginTop: "0.25rem"
          },
          socialButtonsBlockButton: {
            border: "1px solid var(--auth-gray-2)",
            color: "var(--auth-fg-4)",
            boxShadow: "var(--auth-shadow-1)",
            backgroundColor: "transparent",
            borderRadius: "0.5rem",
            padding: "0.625rem",
            fontSize: "0.875rem",
            fontWeight: "500",
            transition: "all 0.2s",
            "&:hover": {
              backgroundColor: "#f9fafb"
            }
          },
          formFieldInput: {
            backgroundColor: "var(--auth-bg-1)",
            border: "1px solid var(--auth-gray-2)",
            color: "var(--auth-fg-4)",
            boxShadow: "var(--auth-shadow-1)",
            borderRadius: "0.5rem",
            padding: "0.625rem 0.875rem",
            fontSize: "0.875rem",
            "&:focus": {
              borderColor: "#6366f1",
              boxShadow: "0 0 0 1px #6366f1"
            }
          },
          formFieldLabel: {
            color: "var(--auth-fg-4)",
            fontWeight: "500",
            fontSize: "0.875rem"
          },
          formButtonPrimary: {
            backgroundColor: "oklch(0.455 0.188 264.1)",
            color: "white",
            borderRadius: "0.5rem",
            padding: "0.625rem",
            fontSize: "0.875rem",
            fontWeight: "500",
            transition: "opacity 0.2s",
            textTransform: "none",
            "&:hover": {
              backgroundColor: "oklch(0.455 0.188 264.1)",
              opacity: 0.9
            }
          },
          dividerLine: {
            backgroundColor: "var(--auth-gray-2)",
          },
          dividerText: {
            color: "var(--auth-fg-2)",
            fontSize: "0.75rem"
          },
          footerActionText: {
            color: "var(--auth-fg-3)",
          },
          footerActionLink: {
            color: "var(--auth-fg-4)",
            fontWeight: "500",
            textDecoration: "none",
            "&:hover": {
              textDecoration: "underline"
            }
          },
          identityPreviewText: {
            color: "var(--auth-fg-4)",
          },
          identityPreviewEditButtonIcon: {
            color: "var(--auth-fg-3)",
          },
          formResendCodeLink: {
            color: "var(--auth-fg-4)",
          }
        },
        layout: {
          socialButtonsPlacement: "bottom",
          socialButtonsVariant: "blockButton",
        }
      }}
    >
      <ConvexProviderWithClerk client={convex!} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
