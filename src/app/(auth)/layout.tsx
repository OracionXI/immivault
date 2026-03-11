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

function Logo() {
    return (
        <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" strokeLinejoin="round" />
                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-gray-900">ImmiVault</span>
        </div>
    );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        /* Outer frame — neutral bg that shows around the floating left panel */
        <div className="flex min-h-screen w-full bg-[#f0f1f4] lg:gap-5 lg:p-5">

            {/* ── Left panel: floating, rounded, shadowed ── */}
            <div
                className="relative hidden flex-1 flex-col justify-between overflow-hidden rounded-3xl lg:flex"
                style={{
                    background: "linear-gradient(145deg, #0d1424 0%, #0f1c38 55%, #0b1628 100%)",
                    boxShadow: "0 20px 60px rgba(9,15,30,0.45), 0 4px 16px rgba(9,15,30,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
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

                {/* Ambient orbs */}
                <div
                    className="pointer-events-none absolute -top-40 right-0 h-[520px] w-[520px] rounded-full opacity-[0.12]"
                    style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)" }}
                />
                <div
                    className="pointer-events-none absolute -bottom-32 -left-20 h-[380px] w-[380px] rounded-full opacity-[0.10]"
                    style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }}
                />

                {/* Top: branding */}
                <div className="relative z-10 px-12 pt-11">
                    <div className="mb-10 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px] text-white" stroke="currentColor" strokeWidth={2}>
                                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" strokeLinejoin="round" />
                                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold tracking-wide text-white/75">ImmiVault</span>
                    </div>

                    <h2 className="max-w-xs text-[1.75rem] font-semibold leading-snug tracking-tight text-white">
                        Manage immigration<br />cases, worldwide.
                    </h2>
                    <p className="mt-3 max-w-[240px] text-sm leading-relaxed text-white/45">
                        Track cases, clients, and deadlines across borders — all from one intelligent platform.
                    </p>
                </div>

                {/* Centre: animated globe */}
                <div className="relative z-10 flex flex-1 items-center justify-center py-4">
                    <AnimatedGlobe />
                </div>

                {/* Bottom: stats */}
                <div className="relative z-10 px-12 pb-11">
                    <div className="grid grid-cols-3 gap-2.5">
                        {stats.map((s) => (
                            <div
                                key={s.label}
                                className="rounded-2xl px-4 py-3 text-center ring-1 ring-white/[0.08]"
                                style={{ background: "rgba(255,255,255,0.05)" }}
                            >
                                <div className="text-base font-semibold text-white">{s.value}</div>
                                <div className="mt-0.5 text-[11px] text-white/40">{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <p className="mt-5 text-center text-[11px] text-white/20">
                        Trusted by immigration attorneys and law firms globally
                    </p>
                </div>
            </div>

            {/* ── Right panel: form ── */}
            <div className="flex w-full flex-col bg-white lg:w-[50%] lg:shrink-0 lg:rounded-3xl lg:shadow-[0_4px_24px_rgba(0,0,0,0.06)]">

                {/* Logo — pinned to top */}
                <div className="flex shrink-0 items-center justify-between px-8 pt-7">
                    <div className="lg:hidden"><Logo /></div>
                    <div className="hidden w-full justify-end lg:flex"><Logo /></div>
                </div>

                {/* Form — vertically centred in all remaining space */}
                <div className="flex flex-1 items-center justify-center px-8 py-10">
                    <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 w-full max-w-[400px]">
                        {children}
                    </div>
                </div>

            </div>
        </div>
    );
}
