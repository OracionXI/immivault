"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PortalWelcomePage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const [progress, setProgress] = useState(0);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(null);

  // Fetch session to get org name, client name, and profileCompleted
  useEffect(() => {
    fetch("/api/portal/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.client) {
          router.replace(`/portal/${orgSlug}`);
          return;
        }
        setOrgName(data.org?.name ?? null);
        setClientName(data.client?.firstName ?? null);
        setProfileCompleted(data.profileCompleted ?? false);
      })
      .catch(() => router.replace(`/portal/${orgSlug}`));
  }, [orgSlug, router]);

  // Animate progress bar and redirect after animation
  useEffect(() => {
    if (profileCompleted === null) return; // wait until we know the status

    const duration = 2800;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      setProgress(Math.min((elapsed / duration) * 100, 100));
      if (elapsed < duration) requestAnimationFrame(tick);
    };

    const raf = requestAnimationFrame(tick);

    const destination = profileCompleted
      ? `/portal/${orgSlug}/dashboard`   // returning client: skip wizard
      : `/portal/${orgSlug}/onboarding`; // new client: go to profile wizard

    const timer = setTimeout(() => router.push(destination), 3200);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [profileCompleted, orgSlug, router]);

  return (
    <>
      <style>{`
        @keyframes logo-enter {
          from { opacity: 0; transform: scale(0.75); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .logo-enter { animation: logo-enter 700ms cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .headline   { animation: fade-up 600ms ease forwards; animation-delay: 350ms; opacity: 0; }
        .subtitle   { animation: fade-up 600ms ease forwards; animation-delay: 600ms; opacity: 0; }
        .badge      { animation: fade-up 600ms ease forwards; animation-delay: 850ms; opacity: 0; }
        .bar        { animation: fade-up 600ms ease forwards; animation-delay: 1100ms; opacity: 0; }
      `}</style>

      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        {/* Logo */}
        <div className="logo-enter mb-8">
          <div className="h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-white" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
          </div>
        </div>

        {/* Headline */}
        <h1 className="headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Welcome{clientName ? `, ${clientName}` : ""}!
        </h1>

        {/* Subtitle */}
        <p className="subtitle mt-3 text-base text-muted-foreground max-w-sm">
          {orgName
            ? `You're now connected to ${orgName}'s client portal.`
            : "You're now connected to your client portal."}
        </p>

        {/* Badge */}
        <div className="badge mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          {profileCompleted ? "Loading your dashboard…" : "Let's set up your profile…"}
        </div>

        {/* Progress bar */}
        <div className="bar mt-12 w-48 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-600 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </>
  );
}
