import type { Metadata } from "next";
import { AnimatedGlobe } from "./_components/animated-globe";

export const metadata: Metadata = {
    title: "ImmiVault — Immigration Case Management",
};

const stats = [
    { value: "10,000+", label: "Cases managed" },
    { value: "500+",    label: "Law firms" },
    { value: "98%",     label: "Satisfaction" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen w-full overflow-hidden bg-white">

            {/* ── Left (40%): form panel ── */}
            <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2 lg:shrink-0">
                {children}
            </div>

            {/* ── Right (60%): marketing + animated globe ── */}
            <div
                className="relative hidden flex-1 flex-col justify-between overflow-hidden lg:flex"
                style={{ background: "linear-gradient(145deg, #0d1424 0%, #0f1c38 55%, #0b1628 100%)" }}
            >
                {/* Background grid */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.035]"
                    style={{
                        backgroundImage:
                            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                        backgroundSize: "52px 52px",
                    }}
                />

                {/* Ambient colour orbs */}
                <div
                    className="pointer-events-none absolute -top-40 right-0 h-[520px] w-[520px] rounded-full opacity-[0.12]"
                    style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)" }}
                />
                <div
                    className="pointer-events-none absolute -bottom-32 -left-20 h-[380px] w-[380px] rounded-full opacity-[0.10]"
                    style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }}
                />

                {/* ── Top: branding + headline ── */}
                <div className="relative z-10 px-14 pt-12">
                    {/* Logo + wordmark */}
                    <div className="mb-10 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                            <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5 text-white" stroke="currentColor" strokeWidth={2}>
                                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" strokeLinejoin="round" />
                                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold tracking-wide text-white/75">ImmiVault</span>
                    </div>

                    {/* Headline */}
                    <h2 className="max-w-sm text-[1.85rem] font-semibold leading-snug tracking-tight text-white">
                        Manage immigration<br />cases, worldwide.
                    </h2>
                    <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/45">
                        Track cases, clients, and deadlines across borders — all from one intelligent platform.
                    </p>
                </div>

                {/* ── Centre: animated globe ── */}
                <div className="relative z-10 flex flex-1 items-center justify-center py-6">
                    <AnimatedGlobe />
                </div>

                {/* ── Bottom: stats row ── */}
                <div className="relative z-10 px-14 pb-12">
                    <div className="grid grid-cols-3 gap-3">
                        {stats.map((s) => (
                            <div
                                key={s.label}
                                className="rounded-xl px-4 py-3 text-center ring-1 ring-white/10"
                                style={{ background: "rgba(255,255,255,0.05)" }}
                            >
                                <div className="text-lg font-semibold text-white">{s.value}</div>
                                <div className="mt-0.5 text-xs text-white/40">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Tagline */}
                    <p className="mt-5 text-center text-xs text-white/25">
                        Trusted by immigration attorneys and law firms globally
                    </p>
                </div>
            </div>
        </div>
    );
}
