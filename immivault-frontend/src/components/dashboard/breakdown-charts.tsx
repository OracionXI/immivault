"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── Status colour map ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    "To Do":       "#6b7280",
    "In Progress": "#f59e0b",
    "In Review":   "#8b5cf6",
    "On Hold":     "#3b82f6",
    "Completed":   "#10b981",
    "Archive":     "#9ca3af",
    "Rejected":    "#ef4444",
};
const FALLBACK_COLORS = ["#a855f7", "#06b6d4", "#f43f5e", "#84cc16", "#fb923c"];
function statusColor(status: string, index: number) {
    return STATUS_COLORS[status] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// ── Custom tooltips ───────────────────────────────────────────────────────────

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0];
    return (
        <div className="rounded-lg border bg-card p-2.5 shadow-md text-xs">
            <p className="font-semibold text-foreground">{name}</p>
            <p className="text-muted-foreground">{value} {value === 1 ? "case" : "cases"}</p>
        </div>
    );
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border bg-card p-2.5 shadow-md text-xs">
            <p className="font-semibold text-foreground truncate max-w-[180px]">{label}</p>
            <p className="text-muted-foreground">{payload[0].value} {payload[0].value === 1 ? "case" : "cases"}</p>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

interface BreakdownChartsProps {
    showCaseStatus?: boolean;
    showCasesPerClient?: boolean;
}

export function BreakdownCharts({ showCaseStatus = true, showCasesPerClient = true }: BreakdownChartsProps) {
    const data = useQuery(api.dashboard.queries.chartBreakdown);

    if (!data) {
        return (
            <div className={cn("grid gap-6", showCaseStatus && showCasesPerClient ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                {[showCaseStatus, showCasesPerClient].filter(Boolean).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="h-[300px] flex items-center justify-center">
                            <span className="text-sm text-muted-foreground animate-pulse">Loading chart…</span>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className={cn("grid gap-6", showCaseStatus && showCasesPerClient ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
            {/* ── Pie: Case Status Distribution ─────────────────────────── */}
            {showCaseStatus && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Case Status Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        {data.casesByStatus.length === 0 ? (
                            <div className="h-[280px] flex items-center justify-center">
                                <p className="text-sm text-muted-foreground">No cases yet.</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280} debounce={50}>
                                <PieChart>
                                    <Pie
                                        data={data.casesByStatus}
                                        dataKey="count"
                                        nameKey="status"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={64}
                                        outerRadius={104}
                                        paddingAngle={2}
                                    >
                                        {data.casesByStatus.map((entry, index) => (
                                            <Cell
                                                key={entry.status}
                                                fill={statusColor(entry.status, index)}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<PieTooltip />} />
                                    <Legend
                                        formatter={(value) => (
                                            <span className="text-xs text-foreground">{value}</span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ── Bar: Cases per Client ──────────────────────────────────── */}
            {showCasesPerClient && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Cases per Client</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        {data.casesPerClient.length === 0 ? (
                            <div className="h-[280px] flex items-center justify-center">
                                <p className="text-sm text-muted-foreground">No cases yet.</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280} debounce={50}>
                                <BarChart
                                    data={data.casesPerClient}
                                    layout="vertical"
                                    margin={{ top: 4, right: 20, bottom: 4, left: 4 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                                    <XAxis
                                        type="number"
                                        allowDecimals={false}
                                        tick={{ fontSize: 11, style: { fill: "var(--muted-foreground)" } }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={110}
                                        tick={{ fontSize: 11, style: { fill: "var(--muted-foreground)" } }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v: string) =>
                                            v.length > 14 ? v.slice(0, 13) + "…" : v
                                        }
                                    />
                                    <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(100, 116, 139, 0.08)" }} />
                                    <Bar
                                        dataKey="cases"
                                        fill="#f59e0b"
                                        radius={[0, 4, 4, 0]}
                                        maxBarSize={22}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
