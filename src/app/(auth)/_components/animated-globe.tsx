"use client";

/* ─────────────────────────────────────────────────────────────────
   AnimatedGlobe
   • SVG globe with latitude / longitude grid lines
   • Dashed orbit ring (split front / back for depth illusion)
   • Airplane silhouette animates along the orbit with rotate="auto"
   • Pulsing location pins scattered on the globe
───────────────────────────────────────────────────────────────── */

export function AnimatedGlobe() {
    return (
        <div className="relative flex items-center justify-center select-none">
            {/* Ambient blue glow behind the globe */}
            <div
                className="pointer-events-none absolute h-[520px] w-[520px] rounded-full opacity-25 blur-3xl"
                style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)" }}
            />

            <svg
                viewBox="0 0 300 300"
                className="relative h-[700px] w-[700px]"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
            >
                <defs>
                    {/* ── Globe gradient (light upper-left → dark lower-right) ── */}
                    <radialGradient id="gGrad" cx="32%" cy="28%" r="70%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.9" />
                        <stop offset="45%" stopColor="#1e40af" />
                        <stop offset="100%" stopColor="#0c1340" />
                    </radialGradient>

                    {/* Clip to globe circle */}
                    <clipPath id="gClip">
                        <circle cx="150" cy="150" r="100" />
                    </clipPath>

                    {/* ── Full orbit path (tilted –25°) for animateMotion ── */}
                    {/*  Ellipse: cx=150 cy=150 rx=118 ry=42, rotated –25° around centre  */}
                    {/*  Two arcs, plane goes OVER the top first                           */}
                    <path
                        id="orbitPath"
                        d="M 268,150 A 118,42,0,1,0,32,150 A 118,42,0,1,0,268,150"
                        transform="rotate(-25, 150, 150)"
                    />
                </defs>

                {/* ═══ BACK orbit arc (drawn before globe → appears behind) ═══ */}
                {/* This is the lower / "far" half of the orbit */}
                <path
                    d="M 32,150 A 118,42,0,1,0,268,150"
                    transform="rotate(-25, 150, 150)"
                    fill="none"
                    stroke="rgba(148,163,184,0.15)"
                    strokeWidth="1.5"
                    strokeDasharray="5 6"
                    strokeLinecap="round"
                />

                {/* ═══ GLOBE ═══ */}

                {/* Outer soft glow ring */}
                <circle cx="150" cy="150" r="110" fill="rgba(37,99,235,0.07)" />

                {/* Globe body */}
                <circle cx="150" cy="150" r="100" fill="url(#gGrad)" />

                {/* Grid lines clipped to globe */}
                <g clipPath="url(#gClip)" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="0.7">
                    {/* Latitude lines (horizontal ellipses, perspective-squished) */}
                    {/* y offsets: ±37, ±67, ±93  → ry = 100-y_offset * 0.27 */}
                    <ellipse cx="150" cy="150" rx="100" ry="28" />  {/* equator */}
                    <ellipse cx="150" cy="113" rx="87" ry="24" />
                    <ellipse cx="150" cy="187" rx="87" ry="24" />
                    <ellipse cx="150" cy="83" rx="51" ry="14" />
                    <ellipse cx="150" cy="217" rx="51" ry="14" />

                    {/* Longitude lines (vertical ellipses / straight lines) */}
                    <line x1="150" y1="50" x2="150" y2="250" />          {/* prime meridian */}
                    <line x1="50" y1="150" x2="250" y2="150" />         {/* date-line */}
                    <ellipse cx="150" cy="150" rx="30" ry="100" />      {/* 75°  */}
                    <ellipse cx="150" cy="150" rx="76" ry="100" />      {/* 40°  */}
                </g>

                {/* Globe border */}
                <circle
                    cx="150" cy="150" r="100"
                    fill="none"
                    stroke="rgba(96,165,250,0.45)"
                    strokeWidth="1.5"
                />

                {/* Specular highlight */}
                <ellipse
                    cx="116" cy="110" rx="26" ry="16"
                    fill="rgba(255,255,255,0.07)"
                    transform="rotate(-30, 116, 110)"
                />

                {/* ── Location pins (pulsing dots on the globe surface) ── */}
                {/* USA */}
                <g>
                    <circle cx="96" cy="128" r="3.5" fill="rgba(251,191,36,0.9)" />
                    <circle cx="96" cy="128" r="3.5" fill="rgba(251,191,36,0.4)">
                        <animate attributeName="r" values="3.5;7;3.5" dur="2.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;0;0.7" dur="2.8s" repeatCount="indefinite" />
                    </circle>
                </g>
                {/* Europe */}
                <g>
                    <circle cx="162" cy="112" r="3" fill="rgba(167,243,208,0.9)" />
                    <circle cx="162" cy="112" r="3" fill="rgba(167,243,208,0.4)">
                        <animate attributeName="r" values="3;6.5;3" dur="3.4s" repeatCount="indefinite" begin="0.8s" />
                        <animate attributeName="opacity" values="0.7;0;0.7" dur="3.4s" repeatCount="indefinite" begin="0.8s" />
                    </circle>
                </g>
                {/* South Asia */}
                <g>
                    <circle cx="198" cy="145" r="3.5" fill="rgba(248,113,113,0.9)" />
                    <circle cx="198" cy="145" r="3.5" fill="rgba(248,113,113,0.4)">
                        <animate attributeName="r" values="3.5;7;3.5" dur="2.2s" repeatCount="indefinite" begin="1.5s" />
                        <animate attributeName="opacity" values="0.7;0;0.7" dur="2.2s" repeatCount="indefinite" begin="1.5s" />
                    </circle>
                </g>
                {/* Australia */}
                <g>
                    <circle cx="212" cy="178" r="2.5" fill="rgba(167,139,250,0.9)" />
                    <circle cx="212" cy="178" r="2.5" fill="rgba(167,139,250,0.4)">
                        <animate attributeName="r" values="2.5;5.5;2.5" dur="3.1s" repeatCount="indefinite" begin="2.2s" />
                        <animate attributeName="opacity" values="0.7;0;0.7" dur="3.1s" repeatCount="indefinite" begin="2.2s" />
                    </circle>
                </g>

                {/* ═══ FRONT orbit arc (drawn after globe → appears in front) ═══ */}
                {/* This is the upper / "near" half of the orbit */}
                <path
                    d="M 268,150 A 118,42,0,1,0,32,150"
                    transform="rotate(-25, 150, 150)"
                    fill="none"
                    stroke="rgba(148,163,184,0.35)"
                    strokeWidth="1.5"
                    strokeDasharray="5 6"
                    strokeLinecap="round"
                />

                {/* ═══ ANIMATED AIRPLANE ═══ */}

                {/* Plane glow (slightly larger, blurred behind the plane) */}
                <g opacity="0.5">
                    <path d="M 7,0 L 2,-1 L 1.5,-6 L -0.5,-5 L -0.5,-1 L -5.5,-0.8 L -6.5,0 L -5.5,0.8 L -0.5,1 L -0.5,5 L 1.5,6 L 2,1 Z"
                        fill="rgba(147,197,253,1)">
                        <animateMotion dur="11s" repeatCount="indefinite" rotate="auto">
                            <mpath href="#orbitPath" />
                        </animateMotion>
                    </path>
                </g>

                {/* Plane silhouette (top-down, nose facing right) */}
                {/* Fuselage runs left→right, wings spread up/down */}
                <path
                    d="M 7,0 L 2,-1 L 1.5,-6 L -0.5,-5 L -0.5,-1 L -5.5,-0.8 L -6.5,0 L -5.5,0.8 L -0.5,1 L -0.5,5 L 1.5,6 L 2,1 Z"
                    fill="white"
                >
                    <animateMotion dur="11s" repeatCount="indefinite" rotate="auto">
                        <mpath href="#orbitPath" />
                    </animateMotion>
                </path>

                {/* Tiny engine-glow dot at nose */}
                <circle r="1.5" fill="rgba(253,224,132,0.95)">
                    <animateMotion dur="11s" repeatCount="indefinite" rotate="auto">
                        <mpath href="#orbitPath" />
                    </animateMotion>
                </circle>
            </svg>
        </div>
    );
}
