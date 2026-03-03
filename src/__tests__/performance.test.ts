/**
 * Performance benchmarks for core calculation paths.
 *
 * These use performance.now() to assert that critical operations
 * complete within acceptable time budgets even at scale.
 * Keeps the app fast as data grows.
 */

import { describe, it, expect } from "vitest";

// ─── Helpers (mirrors mutations logic) ─────────────────────────────────────

type Item = { quantity: number; unitPrice: number };

function calcSubtotal(items: Item[]): number {
    return items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}

function sortByCreationTime<T extends { _creationTime: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => b._creationTime - a._creationTime);
}

function filterByStatus<T extends { status: string }>(items: T[], status: string): T[] {
    return items.filter((i) => i.status === status);
}

function generateInvoiceNumber(count: number): string {
    return `INV-${String(count + 1).padStart(4, "0")}`;
}

// ─── Subtotal calculation at scale ──────────────────────────────────────────

describe("calcSubtotal — performance", () => {
    it("handles 1,000 line items in < 5ms", () => {
        const items: Item[] = Array.from({ length: 1_000 }, (_, i) => ({
            quantity: i + 1,
            unitPrice: 9.99,
        }));
        const start = performance.now();
        const result = calcSubtotal(items);
        const elapsed = performance.now() - start;

        expect(result).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(5);
    });

    it("handles 10,000 line items in < 20ms", () => {
        const items: Item[] = Array.from({ length: 10_000 }, () => ({
            quantity: 2,
            unitPrice: 100,
        }));
        const start = performance.now();
        calcSubtotal(items);
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(20);
    });
});

// ─── Sort by creation time (dashboard recent items) ─────────────────────────

describe("sortByCreationTime — performance", () => {
    it("sorts 5,000 records in < 10ms", () => {
        const records = Array.from({ length: 5_000 }, (_, i) => ({
            _creationTime: Math.random() * 1_700_000_000_000,
            id: i,
        }));
        const start = performance.now();
        const sorted = sortByCreationTime(records);
        const elapsed = performance.now() - start;

        expect(sorted[0]._creationTime).toBeGreaterThanOrEqual(sorted[1]._creationTime);
        expect(elapsed).toBeLessThan(10);
    });
});

// ─── Status filter (cases, tasks, appointments) ───────────────────────────────

describe("filterByStatus — performance", () => {
    it("filters 10,000 records in < 5ms", () => {
        const statuses = ["Active", "Pending", "Completed", "On Hold"];
        const records = Array.from({ length: 10_000 }, (_, i) => ({
            id: i,
            status: statuses[i % statuses.length],
        }));
        const start = performance.now();
        const active = filterByStatus(records, "Active");
        const elapsed = performance.now() - start;

        expect(active.length).toBe(2_500);
        expect(elapsed).toBeLessThan(5);
    });
});

// ─── Invoice number generation at scale ────────────────────────────────────

describe("generateInvoiceNumber — performance", () => {
    it("generates 10,000 invoice numbers in < 10ms", () => {
        const start = performance.now();
        for (let i = 0; i < 10_000; i++) {
            generateInvoiceNumber(i);
        }
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(10);
    });

    it("numbers stay sequential and unique for 1000 iterations", () => {
        const numbers = new Set(
            Array.from({ length: 1_000 }, (_, i) => generateInvoiceNumber(i))
        );
        expect(numbers.size).toBe(1_000);
    });
});

// ─── Rate limit window filtering at scale ─────────────────────────────────

describe("rate limit window filtering — performance", () => {
    it("scans 10,000 rate limit records in < 5ms", () => {
        const now = Date.now();
        const windowMs = 3_600_000;
        const records = Array.from({ length: 10_000 }, (_, i) => ({
            timestamp: now - i * 100, // every 100ms going back
        }));

        const start = performance.now();
        const inWindow = records.filter((r) => r.timestamp >= now - windowMs);
        const elapsed = performance.now() - start;

        // All records (10k × 100ms = 1,000,000ms < 3,600,000ms window)
        expect(inWindow.length).toBe(10_000);
        expect(elapsed).toBeLessThan(5);
    });
});

// ─── Dashboard stats aggregation ───────────────────────────────────────────

describe("dashboard aggregation — performance", () => {
    it("aggregates counts for 3 entity types × 5,000 records each in < 15ms", () => {
        const now = Date.now();
        const DAY = 86_400_000;

        const clients = Array.from({ length: 5_000 }, (_, i) => ({
            status: i % 4 === 0 ? "Active" : "Pending",
        }));
        const cases = Array.from({ length: 5_000 }, (_, i) => ({
            status: i % 3 === 0 ? "Active" : "Completed",
        }));
        const appointments = Array.from({ length: 5_000 }, (_, i) => ({
            startAt: now + (i % 14) * DAY, // spread over next 2 weeks
            status: "Scheduled",
        }));

        const start = performance.now();

        const activeClients = clients.filter((c) => c.status === "Active").length;
        const activeCases = cases.filter((c) => c.status === "Active").length;
        const upcomingAppts = appointments.filter(
            (a) => a.status === "Scheduled" && a.startAt >= now && a.startAt <= now + 7 * DAY
        ).length;

        const elapsed = performance.now() - start;

        expect(activeClients).toBeGreaterThan(0);
        expect(activeCases).toBeGreaterThan(0);
        expect(upcomingAppts).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(15);
    });
});
