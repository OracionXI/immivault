import { useState, useEffect } from "react";

export type WidgetId =
  | "stat_cards"
  | "revenue_chart"
  | "task_management"
  | "recent_cases"
  | "case_status"
  | "cases_per_client"
  | "staff"
  | "calendar";

const STORAGE_KEY = "immivault_dashboard_widgets";

const DEFAULTS: Record<WidgetId, boolean> = {
  stat_cards: true,
  revenue_chart: true,
  task_management: true,
  recent_cases: true,
  case_status: false,
  cases_per_client: false,
  staff: true,
  calendar: true,
};

export function useWidgetConfig() {
  const [config, setConfig] = useState<Record<WidgetId, boolean>>(DEFAULTS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setConfig({ ...DEFAULTS, ...JSON.parse(saved) });
      }
    } catch {}
  }, []);

  const saveConfig = (next: Record<WidgetId, boolean>) => {
    setConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const isVisible = (id: WidgetId) => config[id] ?? true;

  return { config, saveConfig, isVisible };
}
