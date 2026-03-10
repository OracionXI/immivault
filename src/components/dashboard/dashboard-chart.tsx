"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    { key: "revenue",       label: "Revenue ($)",     color: "#10b981", format: (v) => `$${v.toLocaleString()}`, adminOnly: true },
    { key: "cases",         label: "Cases Opened",    color: "#f59e0b", format: (v) => String(v) },
    { key: "clients",       label: "Clients Added",   color: "#3b82f6", format: (v) => String(v), adminOnly: true },
    { key: "appointments",  label: "Appointments",    color: "#8b5cf6", format: (v) => String(v) },
    { key: "tasksCompleted",label: "Tasks Completed", color: "#ec4899", format: (v) => String(v) },
];

const RANGES = [
    { value: "3", label: "Last 3 months" },
    { value: "6", label: "Last 6 months" },
    { value: "12", label: "Last 12 months" },
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
    return (
        <div className="rounded-lg border bg-card p-3 shadow-md text-sm min-w-[140px]">
            <p className="font-semibold text-foreground mb-1.5">{label}</p>
            {payload.map((entry) => {
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
}

export function DashboardChart({ isAdmin = true }: DashboardChartProps) {
    const METRICS = ALL_METRICS.filter((m) => isAdmin || !m.adminOnly);

    const [range, setRange] = useState("6");
    const [primaryMetric, setPrimaryMetric] = useState<MetricKey>(isAdmin ? "revenue" : "cases");
    const [secondaryMetric, setSecondaryMetric] = useState<MetricKey>("tasksCompleted");

    const data = useQuery(api.dashboard.queries.chartData, { months: Number(range) });

    const primary = METRICS.find((m) => m.key === primaryMetric) ?? METRICS[0];
    const secondary = METRICS.find((m) => m.key === secondaryMetric);

    // Determine if primary Y and secondary Y share the same scale
    const dualAxis = primaryMetric === "revenue" && secondaryMetric !== "revenue";

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="text-base font-semibold">Trends</CardTitle>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Primary Y */}
                        <Select value={primaryMetric} onValueChange={(v) => setPrimaryMetric(v as MetricKey)}>
                            <SelectTrigger className="h-8 text-xs w-[160px]">
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

                        {/* Secondary Y */}
                        <Select value={secondaryMetric} onValueChange={(v) => setSecondaryMetric(v as MetricKey)}>
                            <SelectTrigger className="h-8 text-xs w-[160px]">
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

                        {/* Range */}
                        <Select value={range} onValueChange={setRange}>
                            <SelectTrigger className="h-8 text-xs w-[130px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {RANGES.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-2">
                {!data ? (
                    <div className="h-[280px] flex items-center justify-center">
                        <span className="text-sm text-muted-foreground animate-pulse">Loading chart…</span>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={data} margin={{ top: 4, right: dualAxis ? 16 : 4, bottom: 0, left: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                className="fill-muted-foreground"
                            />

                            {/* Left Y axis — primary metric */}
                            <YAxis
                                yAxisId="left"
                                tickFormatter={(v) =>
                                    primaryMetric === "revenue" && v >= 1000
                                        ? `$${(v / 1000).toFixed(0)}k`
                                        : String(v)
                                }
                                tick={{ fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                className="fill-muted-foreground"
                                width={dualAxis ? 52 : 40}
                            />

                            {/* Right Y axis — secondary metric (only when scales differ) */}
                            {dualAxis && (
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    className="fill-muted-foreground"
                                    width={32}
                                />
                            )}

                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                formatter={(value) => {
                                    const metric = METRICS.find((m) => m.key === value);
                                    return (
                                        <span className="text-xs text-foreground">{metric?.label ?? value}</span>
                                    );
                                }}
                            />

                            {/* Primary — Bar */}
                            <Bar
                                yAxisId="left"
                                dataKey={primaryMetric}
                                fill={primary.color}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={48}
                                opacity={0.85}
                            />

                            {/* Secondary — Line */}
                            {secondary && (
                                <Line
                                    yAxisId={dualAxis ? "right" : "left"}
                                    dataKey={secondaryMetric}
                                    stroke={secondary.color}
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: secondary.color }}
                                    activeDot={{ r: 5 }}
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
