"use client";

import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, LayoutDashboard, BarChart2, CheckSquare, Briefcase, PieChart, Users, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetId } from "@/hooks/use-widget-config";

// ── Mini Previews ──────────────────────────────────────────────────────────

function StatsMiniPreview() {
  return (
    <div className="flex gap-1.5 w-full">
      {[["2.4K", "Clients"], ["48", "Cases"], ["12", "Tasks"]].map(([val, label]) => (
        <div key={label} className="flex-1 rounded-lg bg-muted p-2">
          <div className="text-[9px] text-muted-foreground mb-1 leading-none">{label}</div>
          <div className="text-sm font-bold leading-none">{val}</div>
        </div>
      ))}
    </div>
  );
}

function RevenueMiniPreview() {
  const bars = [35, 55, 40, 70, 50, 85, 60, 90, 65, 75, 45, 80];
  return (
    <div className="flex items-end gap-0.5 w-full h-full px-1 pb-1">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-emerald-400/60"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function TaskMiniPreview() {
  return (
    <div className="w-full space-y-2">
      <div className="flex gap-0.5 h-1 w-full rounded-full overflow-hidden">
        <div className="bg-primary/20 w-1/4 rounded-full" />
        <div className="bg-primary/40 w-1/4 rounded-full" />
        <div className="bg-primary/60 w-1/4 rounded-full" />
        <div className="bg-primary w-1/4 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[["6", "Pending"], ["18", "Done"]].map(([n, l]) => (
          <div key={l} className="rounded-md bg-muted p-1.5">
            <div className="text-[8px] text-muted-foreground">{l}</div>
            <div className="text-xs font-bold">{n}</div>
          </div>
        ))}
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-muted" />
          <div className="h-3 w-8 rounded-full bg-amber-300/50" />
        </div>
      ))}
    </div>
  );
}

function CasesMiniPreview() {
  const statuses = ["#10b981", "#f59e0b", "#3b82f6", "#6b7280", "#ef4444"];
  return (
    <div className="w-full space-y-1.5">
      {statuses.map((color, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-muted" />
          <div className="h-3 w-10 rounded-full" style={{ backgroundColor: color + "55" }} />
        </div>
      ))}
    </div>
  );
}

function PieMiniPreview() {
  // Circumference ≈ 100 for r=15.9
  const segments = [
    { color: "#10b981", dash: "30 70", offset: "0" },
    { color: "#f59e0b", dash: "22 78", offset: "-30" },
    { color: "#3b82f6", dash: "18 82", offset: "-52" },
    { color: "#6b7280", dash: "30 70", offset: "-70" },
  ];
  return (
    <div className="flex items-center justify-center w-full h-full">
      <svg width="52" height="52" viewBox="0 0 36 36">
        {segments.map((s, i) => (
          <circle
            key={i}
            cx="18" cy="18" r="12"
            fill="none"
            stroke={s.color}
            strokeWidth="6"
            strokeDasharray={s.dash}
            strokeDashoffset={s.offset}
            transform="rotate(-90 18 18)"
          />
        ))}
        <circle cx="18" cy="18" r="8" fill="hsl(var(--card))" />
      </svg>
    </div>
  );
}

function BarMiniPreview() {
  const rows = [
    { w: "85%", color: "#f59e0b" },
    { w: "65%", color: "#f59e0b" },
    { w: "45%", color: "#f59e0b" },
    { w: "30%", color: "#f59e0b" },
    { w: "20%", color: "#f59e0b" },
  ];
  return (
    <div className="w-full space-y-1.5 pt-1">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-6 h-1.5 rounded bg-muted shrink-0" />
          <div className="h-2.5 rounded-sm" style={{ width: r.w, backgroundColor: r.color + "88" }} />
        </div>
      ))}
    </div>
  );
}

function StaffMiniPreview() {
  const colors = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6"];
  return (
    <div className="w-full space-y-1.5">
      {colors.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full shrink-0 flex items-center justify-center text-[8px] text-white font-bold"
            style={{ backgroundColor: c + "88" }}>
            {String.fromCharCode(65 + i)}
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

function CalendarMiniPreview() {
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div className="w-full space-y-1">
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => (
          <div key={i} className="text-center text-[7px] font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {[...Array(14)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 rounded-sm flex items-center justify-center text-[7px] font-medium",
              i === 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Widget Definitions ─────────────────────────────────────────────────────

const WIDGET_DEFS: {
  id: WidgetId;
  label: string;
  description: string;
  icon: React.ElementType;
  preview: React.ReactNode;
}[] = [
  {
    id: "stat_cards",
    label: "Stats Overview",
    description: "Key metrics — clients, cases and tasks at a glance",
    icon: LayoutDashboard,
    preview: <StatsMiniPreview />,
  },
  {
    id: "revenue_chart",
    label: "Revenue Chart",
    description: "Monthly revenue trends and performance analytics",
    icon: TrendingUp,
    preview: <RevenueMiniPreview />,
  },
  {
    id: "task_management",
    label: "Task Management",
    description: "Pending and completed task summary with priorities",
    icon: CheckSquare,
    preview: <TaskMiniPreview />,
  },
  {
    id: "recent_cases",
    label: "Recent Cases",
    description: "Latest case activity and current status overview",
    icon: Briefcase,
    preview: <CasesMiniPreview />,
  },
  {
    id: "case_status",
    label: "Case Status Distribution",
    description: "Breakdown of all cases by their current status",
    icon: PieChart,
    preview: <PieMiniPreview />,
  },
  {
    id: "cases_per_client",
    label: "Cases per Client",
    description: "Horizontal bar chart showing client case load",
    icon: BarChart2,
    preview: <BarMiniPreview />,
  },
  {
    id: "staff",
    label: "Our Staff",
    description: "Team members, their roles and online activity",
    icon: Users,
    preview: <StaffMiniPreview />,
  },
  {
    id: "calendar",
    label: "Upcoming Appointments",
    description: "Weekly calendar view with scheduled appointments",
    icon: Calendar,
    preview: <CalendarMiniPreview />,
  },
];

// ── Widget Card ────────────────────────────────────────────────────────────

function WidgetCard({
  def,
  enabled,
  onToggle,
}: {
  def: (typeof WIDGET_DEFS)[number];
  enabled: boolean;
  onToggle: () => void;
}) {
  const Icon = def.icon;
  return (
    <div
      onClick={onToggle}
      className={cn(
        "group relative flex flex-col rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden select-none",
        enabled
          ? "border-primary/40 bg-card shadow-md shadow-primary/5"
          : "border-border bg-muted/20 opacity-55"
      )}
    >
      {/* Mini preview area */}
      <div className={cn(
        "flex items-center justify-center px-5 py-4 h-[148px] border-b transition-colors",
        enabled ? "border-primary/20 bg-accent/40" : "border-border bg-muted/20"
      )}>
        <div className="w-full h-full flex items-center justify-center">
          {def.preview}
        </div>
      </div>

      {/* Card footer */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-2.5 min-w-0">
          <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", enabled ? "text-primary" : "text-muted-foreground")} />
          <div className="min-w-0">
            <p className={cn("text-sm font-semibold leading-tight", enabled ? "text-foreground" : "text-muted-foreground")}>
              {def.label}
            </p>
            <p className="text-xs text-muted-foreground leading-snug mt-1 line-clamp-2">
              {def.description}
            </p>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 mt-0.5 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none",
            enabled ? "bg-primary" : "bg-muted-foreground/40"
          )}
        >
          <span
            className={cn(
              "pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-4" : "translate-x-0"
            )}
          />
        </button>
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: Record<WidgetId, boolean>;
  onApply: (config: Record<WidgetId, boolean>) => void;
}

export function CustomizeWidgetsModal({ open, onOpenChange, config, onApply }: Props) {
  const [draft, setDraft] = useState<Record<WidgetId, boolean>>(config);
  const [search, setSearch] = useState("");

  // Sync draft from localStorage-loaded config whenever modal opens
  useEffect(() => {
    if (open) setDraft(config);
    else setSearch("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
  };

  const toggle = (id: WidgetId) =>
    setDraft((prev) => ({ ...prev, [id]: !prev[id] }));

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return WIDGET_DEFS;
    return WIDGET_DEFS.filter(
      (w) =>
        w.label.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q)
    );
  }, [search]);

  const enabledCount = Object.values(draft).filter(Boolean).length;

  const handleApply = () => {
    onApply(draft);
    setSearch("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setDraft(config);
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        style={{ width: "85vw", maxWidth: "85vw", height: "90vh", maxHeight: "90vh" }}
        className="flex flex-col p-0 gap-0"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <DialogTitle className="text-xl font-semibold">Customize Dashboard</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1.5">
                Toggle widgets on or off to personalise your dashboard view.
              </p>
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-accent px-3 py-1.5 rounded-full shrink-0 mt-0.5 border border-border">
              {enabledCount} of {WIDGET_DEFS.length} active
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search widgets..."
              className="pl-10 h-10 bg-background text-sm"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-8">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No widgets match &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((def) => (
                <WidgetCard
                  key={def.id}
                  def={def}
                  enabled={draft[def.id] ?? true}
                  onToggle={() => toggle(def.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-border flex items-center justify-between shrink-0 bg-accent/20">
          <p className="text-sm text-muted-foreground">
            Changes are saved per browser and apply immediately.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
