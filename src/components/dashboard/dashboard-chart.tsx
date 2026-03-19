"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
    ComposedChart,
    Bar,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// ── Metric config ────────────────────────────────────────────────────────────

type MetricKey = "revenue" | "cases" | "clients" | "appointments" | "tasksCompleted";

const ALL_METRICS: { key: MetricKey; label: string; color: string; format: (v: number) => string; adminOnly?: boolean }[] = [
    { key: "revenue",        label: "Revenue ($)",     color: "#14b8a6", format: (v) => `$${v.toLocaleString()}`, adminOnly: true },
    { key: "cases",          label: "Cases Opened",    color: "#0ea5e9", format: (v) => String(v) },
    { key: "clients",        label: "Clients Added",   color: "#6366f1", format: (v) => String(v), adminOnly: true },
    { key: "appointments",   label: "Appointments",    color: "#38bdf8", format: (v) => String(v) },
    { key: "tasksCompleted", label: "Tasks Completed", color: "#2dd4bf", format: (v) => String(v) },
];

// ── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: { name: string; value: number; color: string; dataKey: string }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;

    // Deduplicate — Area and Bar can share the same dataKey
    const seen = new Set<string>();
    const unique = payload.filter((entry) => {
        if (seen.has(entry.dataKey)) return false;
        seen.add(entry.dataKey);
        return true;
    });

    return (
        <div className="rounded-lg border bg-card p-3 shadow-md text-sm min-w-[140px]">
            <p className="font-semibold text-foreground mb-1.5">{label}</p>
            {unique.map((entry) => {
                const metric = ALL_METRICS.find((m) => m.key === entry.dataKey);
                return (
                    <p key={entry.dataKey} style={{ color: entry.color }} className="flex justify-between gap-4">
                        <span>{metric?.label ?? entry.name}</span>
                        <span className="font-medium">{metric?.format(entry.value) ?? entry.value}</span>
                    </p>
                );
            })}
        </div>
    );
}

// ── Main component ───────────────────────────────────────────────────────────

interface DashboardChartProps {
    isAdmin?: boolean;
    chartArgs?: { days?: number; months?: number };
}

export function DashboardChart({ isAdmin = true, chartArgs }: DashboardChartProps) {
    const METRICS = ALL_METRICS.filter((m) => isAdmin || !m.adminOnly);

    const [primaryMetric, setPrimaryMetric] = useState<MetricKey>(isAdmin ? "revenue" : "cases");
    const [secondaryMetric, setSecondaryMetric] = useState<MetricKey>("cases");

    const data = useQuery(api.dashboard.queries.chartData, chartArgs ?? { months: 6 });

    const primary = METRICS.find((m) => m.key === primaryMetric) ?? METRICS[0];
    const secondary = METRICS.find((m) => m.key === secondaryMetric);

    const dualAxis = primaryMetric === "revenue" && secondaryMetric !== "revenue";

    const primaryGradientId = `grad-primary-${primaryMetric}`;
    const secondaryGradientId = `grad-secondary-${secondaryMetric}`;

    return (
        <div>
            {/* Metric selects */}
            <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                <Select value={primaryMetric} onValueChange={(v) => setPrimaryMetric(v as MetricKey)}>
                    <SelectTrigger className="h-7 text-xs w-[150px] bg-background">
                        <SelectValue placeholder="Primary metric" />
                    </SelectTrigger>
                    <SelectContent>
                        {METRICS.map((m) => (
                            <SelectItem key={m.key} value={m.key} disabled={m.key === secondaryMetric}>
                                {m.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <span className="text-xs text-muted-foreground">vs</span>

                <Select value={secondaryMetric} onValueChange={(v) => setSecondaryMetric(v as MetricKey)}>
                    <SelectTrigger className="h-7 text-xs w-[150px] bg-background">
                        <SelectValue placeholder="Compare with" />
                    </SelectTrigger>
                    <SelectContent>
                        {METRICS.map((m) => (
                            <SelectItem key={m.key} value={m.key} disabled={m.key === primaryMetric}>
                                {m.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Chart */}
            {!data ? (
                <div className="h-[260px] flex items-center justify-center">
                    <span className="text-sm text-muted-foreground animate-pulse">Loading chart…</span>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={260} debounce={50}>
                    <ComposedChart data={data} margin={{ top: 4, right: dualAxis ? 16 : 4, bottom: 0, left: 4 }}>
                        <defs>
                            <linearGradient id={primaryGradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={primary.color} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={primary.color} stopOpacity={0.02} />
                            </linearGradient>
                            {secondary && (
                                <linearGradient id={secondaryGradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={secondary.color} stopOpacity={0.20} />
                                    <stop offset="95%" stopColor={secondary.color} stopOpacity={0.02} />
                                </linearGradient>
                            )}
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.12)" vertical={false} />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, style: { fill: "var(--muted-foreground)" } }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            tickFormatter={(v) =>
                                primaryMetric === "revenue" && v >= 1000
                                    ? `$${(v / 1000).toFixed(0)}k`
                                    : String(v)
                            }
                            tick={{ fontSize: 11, style: { fill: "var(--muted-foreground)" } }}
                            tickLine={false}
                            axisLine={false}
                            width={dualAxis ? 52 : 40}
                        />
                        {dualAxis && (
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fontSize: 11, style: { fill: "var(--muted-foreground)" } }}
                                tickLine={false}
                                axisLine={false}
                                width={32}
                            />
                        )}

                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(100,116,139,0.06)" }} />
                        <Legend
                            formatter={(value) => {
                                const metric = METRICS.find((m) => m.key === value);
                                return <span style={{ fontSize: 11, color: "hsl(var(--foreground))" }}>{metric?.label ?? value}</span>;
                            }}
                        />

                        {/* Primary — Bar (teal, with gradient area behind it) */}
                        <Area
                            yAxisId="left"
                            dataKey={primaryMetric}
                            stroke={primary.color}
                            strokeWidth={0}
                            fill={`url(#${primaryGradientId})`}
                            type="monotone"
                            legendType="none"
                            activeDot={false}
                        />
                        <Bar
                            yAxisId="left"
                            dataKey={primaryMetric}
                            fill={primary.color}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                            opacity={0.80}
                        />

                        {/* Secondary — Area wave */}
                        {secondary && secondaryMetric !== primaryMetric && (
                            <Area
                                yAxisId={dualAxis ? "right" : "left"}
                                dataKey={secondaryMetric}
                                stroke={secondary.color}
                                strokeWidth={2}
                                fill={`url(#${secondaryGradientId})`}
                                type="monotone"
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0, fill: secondary.color }}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
