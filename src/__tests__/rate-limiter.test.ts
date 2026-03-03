/**
 * Tests for the sliding-window rate limiter logic.
 *
 * These mirror the core logic in convex/lib/rateLimit.ts.
 * The Convex ctx.db calls cannot be unit-tested without a running
 * Convex instance, but the window/expiry calculations can be.
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────
// Pure logic extracted from rateLimit.ts
// ─────────────────────────────────────────────

type RateLimitRecord = { timestamp: number };

function countInWindow(records: RateLimitRecord[], now: number, windowMs: number): number {
    return records.filter((r) => r.timestamp >= now - windowMs).length;
}

function isLimitExceeded(
    records: RateLimitRecord[],
    now: number,
    windowMs: number,
    maxRequests: number
): boolean {
    return countInWindow(records, now, windowMs) >= maxRequests;
}

function getExpiredRecords(
    records: RateLimitRecord[],
    now: number,
    windowMs: number
): RateLimitRecord[] {
    return records.filter((r) => r.timestamp < now - windowMs);
}

// ─────────────────────────────────────────────
// countInWindow
// ─────────────────────────────────────────────

describe("countInWindow", () => {
    const now = Date.now();
    const ONE_HOUR = 3_600_000;

    it("counts nothing when records list is empty", () => {
        expect(countInWindow([], now, ONE_HOUR)).toBe(0);
    });

    it("counts all records within the window", () => {
        const records = [
            { timestamp: now - 1_000 },
            { timestamp: now - 60_000 },
            { timestamp: now - 1_800_000 },
        ];
        expect(countInWindow(records, now, ONE_HOUR)).toBe(3);
    });

    it("excludes records outside the window", () => {
        const records = [
            { timestamp: now - 1_000 },        // inside (1s ago)
            { timestamp: now - 4_000_000 },    // outside (>1h ago)
        ];
        expect(countInWindow(records, now, ONE_HOUR)).toBe(1);
    });

    it("treats exactly-at-boundary record as inside", () => {
        const records = [{ timestamp: now - ONE_HOUR }];
        expect(countInWindow(records, now, ONE_HOUR)).toBe(1);
    });
});

// ─────────────────────────────────────────────
// isLimitExceeded
// ─────────────────────────────────────────────

describe("isLimitExceeded", () => {
    const now = Date.now();
    const ONE_HOUR = 3_600_000;

    it("allows requests when under the limit", () => {
        const records = [
            { timestamp: now - 1_000 },
            { timestamp: now - 2_000 },
        ];
        expect(isLimitExceeded(records, now, ONE_HOUR, 5)).toBe(false);
    });

    it("blocks when the limit is exactly reached", () => {
        const records = [
            { timestamp: now - 1_000 },
            { timestamp: now - 2_000 },
        ];
        expect(isLimitExceeded(records, now, ONE_HOUR, 2)).toBe(true);
    });

    it("blocks when over the limit", () => {
        const records = [
            { timestamp: now - 1_000 },
            { timestamp: now - 2_000 },
            { timestamp: now - 3_000 },
        ];
        expect(isLimitExceeded(records, now, ONE_HOUR, 2)).toBe(true);
    });

    it("stale records don't count toward limit", () => {
        const records = [
            { timestamp: now - 4_000_000 }, // expired
            { timestamp: now - 4_100_000 }, // expired
        ];
        expect(isLimitExceeded(records, now, ONE_HOUR, 2)).toBe(false);
    });
});

// ─────────────────────────────────────────────
// getExpiredRecords (cleanup logic)
// ─────────────────────────────────────────────

describe("getExpiredRecords", () => {
    const now = Date.now();
    const ONE_HOUR = 3_600_000;

    it("returns empty when all records are within window", () => {
        const records = [{ timestamp: now - 1_000 }];
        expect(getExpiredRecords(records, now, ONE_HOUR)).toHaveLength(0);
    });

    it("returns only the expired records", () => {
        const records = [
            { timestamp: now - 500 },          // inside
            { timestamp: now - 4_000_000 },    // outside
            { timestamp: now - 5_000_000 },    // outside
        ];
        const expired = getExpiredRecords(records, now, ONE_HOUR);
        expect(expired).toHaveLength(2);
    });

    it("returns all records when all are expired", () => {
        const records = [
            { timestamp: now - 4_000_000 },
            { timestamp: now - 6_000_000 },
        ];
        expect(getExpiredRecords(records, now, ONE_HOUR)).toHaveLength(2);
    });
});

// ─────────────────────────────────────────────
// Real-world rate limit scenarios
// ─────────────────────────────────────────────

describe("real-world rate limit scenarios", () => {
    const ONE_HOUR = 3_600_000;

    it("payment link: 20 per hour limit is enforced", () => {
        const now = Date.now();
        const records: RateLimitRecord[] = Array.from({ length: 20 }, (_, i) => ({
            timestamp: now - i * 1_000,
        }));
        expect(isLimitExceeded(records, now, ONE_HOUR, 20)).toBe(true);
    });

    it("staff invite: 10 per hour limit is enforced", () => {
        const now = Date.now();
        const records: RateLimitRecord[] = Array.from({ length: 10 }, (_, i) => ({
            timestamp: now - i * 1_000,
        }));
        expect(isLimitExceeded(records, now, ONE_HOUR, 10)).toBe(true);
    });

    it("rate limit resets after window expires", () => {
        const now = Date.now();
        // All 20 records are from 2 hours ago — outside the 1-hour window
        const records: RateLimitRecord[] = Array.from({ length: 20 }, (_, i) => ({
            timestamp: now - 2 * ONE_HOUR - i * 1_000,
        }));
        expect(isLimitExceeded(records, now, ONE_HOUR, 20)).toBe(false);
    });
});
