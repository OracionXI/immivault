"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function WelcomePage() {
    const router = useRouter();
    const currentUser = useQuery(api.users.queries.tryGetCurrentUser);
    const [progress, setProgress] = useState(0);

    const firstName = currentUser?.fullName?.split(" ")[0] ?? "";

    // Animate the progress bar from 0 to 100 over ~2.8s, then redirect
    useEffect(() => {
        const start = performance.now();
        const duration = 2800;

        const tick = (now: number) => {
            const elapsed = now - start;
            const pct = Math.min((elapsed / duration) * 100, 100);
            setProgress(pct);
            if (elapsed < duration) {
                requestAnimationFrame(tick);
            }
        };

        const raf = requestAnimationFrame(tick);

        const timer = setTimeout(() => {
            router.push("/dashboard");
        }, 3200);

        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(timer);
        };
    }, [router]);

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
                @keyframes shimmer {
                    from { background-position: -200% center; }
                    to   { background-position: 200% center; }
                }
                .logo-enter   { animation: logo-enter 700ms cubic-bezier(0.34,1.56,0.64,1) forwards; }
                .headline     { animation: fade-up 600ms ease forwards; animation-delay: 350ms; opacity: 0; }
                .subtitle     { animation: fade-up 600ms ease forwards; animation-delay: 620ms; opacity: 0; }
                .badge        { animation: fade-up 600ms ease forwards; animation-delay: 880ms; opacity: 0; }
            `}</style>

            <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
                {/* Logo */}
                <div className="logo-enter mb-8">
                    <div className="relative flex h-20 w-auto items-center justify-center">
                        <img src="/ordena_logo.png" alt="Ordena" className="h-20 w-auto [mix-blend-mode:multiply]" />
                        {/* Glow ring */}
                        <div className="absolute inset-0 rounded-2xl ring-4 ring-primary/10" />
                    </div>
                </div>

                {/* Headline */}
                <h1 className="headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Welcome to Ordena
                    {firstName ? `, ${firstName}` : ""}!
                </h1>

                {/* Subtitle */}
                <p className="subtitle mt-3 text-base text-muted-foreground max-w-sm">
                    Your organisation workspace is ready. Let&rsquo;s get started.
                </p>

                {/* Ready badge */}
                <div className="badge mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-sm text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    All systems ready
                </div>

                {/* Progress bar */}
                <div className="mt-12 w-48 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary transition-none"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Taking you to your dashboard…</p>
            </div>
        </>
    );
}
