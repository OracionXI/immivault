"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/** Returns the org's configured default currency code (e.g. "USD", "GBP"). */
export function useCurrency(): string {
  const settings = useQuery(api.organisations.queries.getSettings);
  return settings?.defaultCurrency ?? "USD";
}
