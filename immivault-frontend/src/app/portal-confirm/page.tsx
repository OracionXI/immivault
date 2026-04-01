"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Shield, Loader2, XCircle, ArrowRight } from "lucide-react";

function PortalConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");
  const orgSlug = searchParams.get("org");

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If params are missing, show error immediately
  const invalid = !token || !orgSlug;

  const handleEnter = async () => {
    if (!token || !orgSlug) return;
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/portal/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orgSlug }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? "This link is invalid or has expired. Please request a new one.");
        setStatus("error");
        return;
      }
      // Cookie is set by the API route — navigate to the portal
      router.replace(`/portal/${data.orgSlug}/welcome`);
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  // Auto-submit once on mount so the user only has to click a single button
  // (the page still acts as a bot-proof gate since prefetch crawlers won't render JS)
  useEffect(() => {
    if (!invalid) handleEnter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (invalid) {
    return (
      <div className="text-center space-y-4">
        <XCircle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-xl font-semibold">Invalid Link</h1>
        <p className="text-sm text-muted-foreground">
          This link is missing required information. Please use the link from your invitation email.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="text-center space-y-4">
        <XCircle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-xl font-semibold">Link Unavailable</h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{errorMsg}</p>
        <button
          onClick={() => router.replace(`/portal/${orgSlug}`)}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors mt-2"
        >
          Go to portal login
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Loading / auto-entering
  return (
    <div className="text-center space-y-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
      <h1 className="text-xl font-semibold">Entering your portal…</h1>
      <p className="text-sm text-muted-foreground">Please wait a moment.</p>
    </div>
  );
}

export default function PortalConfirmPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg p-10 space-y-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Shield className="h-5 w-5" />
          <span className="text-sm font-medium">Secure Portal Access</span>
        </div>
        <Suspense
          fallback={
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            </div>
          }
        >
          <PortalConfirmContent />
        </Suspense>
      </div>
    </div>
  );
}
