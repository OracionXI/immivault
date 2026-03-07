/**
 * Tests for the sliding-window rate limiter logic.
 *
 * These mirror the core logic in convex/lib/rateLimit.ts.
 * The Convex ctx.db calls cannot be unit-tested without a running
 * Convex instance, but the window/expiry calculations can be.
 *
 * Rate-limited operations in this codebase:
 *   - createPaymentLink:<orgId>  → max 20 per hour  (billing/mutations.ts)
 *   - inviteStaff:<orgId>        → max 10 per hour  (users/mutations.ts)
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────
// Pure logic extracted from rateLimit.ts
// ─────────────────────────────────────────────

type RateLimitRecord = { timestamp: number };

/** Mirrors: records.filter((r) => r.timestamp >= now - windowMs) */
function countInWindow(records: RateLimitRecord[], now: number, windowMs: number): number {
    return records.filter((r) => r.timestamp >= now - windowMs).length;
}

/** Mirrors: inWindow.length >= maxRequests */
function isLimitExceeded(
    records: RateLimitRecord[],
    now: number,
    windowMs: number,
    maxRequests: number
): boolean {
    return countInWindow(records, now, windowMs) >= maxRequests;
}

/** Mirrors cleanup: records.filter((r) => r.timestamp < now - windowMs) */
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

    it("treats a record exactly at the window boundary as inside (>= boundary)", () => {
        const records = [{ timestamp: now - ONE_HOUR }];
        expect(countInWindow(records, now, ONE_HOUR)).toBe(1);
    });

    it("counts zero when a record is one millisecond past the boundary", () => {
        const records = [{ timestamp: now - ONE_HOUR - 1 }];
        expect(countInWindow(records, now, ONE_HOUR)).toBe(0);
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

    it("stale records outside the window don't count toward the limit", () => {
        const records = [
            { timestamp: now - 4_000_000 }, // expired
            { timestamp: now - 4_100_000 }, // expired
        ];
        expect(isLimitExceeded(records, now, ONE_HOUR, 2)).toBe(false);
    });

    it("only in-window records count when records straddle the boundary", () => {
        const records = [
            { timestamp: now - 1_000 },        // inside
            { timestamp: now - 4_000_000 },    // outside
            { timestamp: now - 5_000_000 },    // outside
        ];
        // 1 in-window < limit of 2 → allowed
        expect(isLimitExceeded(records, now, ONE_HOUR, 2)).toBe(false);
        // 1 in-window >= limit of 1 → blocked
        expect(isLimitExceeded(records, now, ONE_HOUR, 1)).toBe(true);
    });

    it("maxRequests = 1 blocks on the first recorded request", () => {
        const records = [{ timestamp: now - 500 }];
        expect(isLimitExceeded(records, now, ONE_HOUR, 1)).toBe(true);
    });

    it("empty records are never blocked regardless of limit", () => {
        expect(isLimitExceeded([], now, ONE_HOUR, 1)).toBe(false);
    });
});

// ─────────────────────────────────────────────
// getExpiredRecords (cleanup logic)
// ─────────────────────────────────────────────

describe("getExpiredRecords", () => {
    const now = Date.now();
    const ONE_HOUR = 3_600_000;

    it("returns empty when all records are within the window", () => {
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

    it("treats a record exactly at the boundary as NOT expired (< boundary)", () => {
        // Cleanup uses strict `<` so exactly-at-boundary stays in the window
        const records = [{ timestamp: now - ONE_HOUR }];
        expect(getExpiredRecords(records, now, ONE_HOUR)).toHaveLength(0);
    });

    it("treats a record one millisecond past the boundary as expired", () => {
        const records = [{ timestamp: now - ONE_HOUR - 1 }];
        expect(getExpiredRecords(records, now, ONE_HOUR)).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────
// Real-world rate limit scenarios
// Mirrors actual checkRateLimit call sites in the codebase.
// ─────────────────────────────────────────────

describe("real-world rate limit scenarios", () => {
    const ONE_HOUR = 3_600_000;

    // key: createPaymentLink:<orgId> — billing/mutations.ts
    it("createPaymentLink: 20th request within an hour is blocked", () => {
        const now = Date.now();
        const records: RateLimitRecord[] = Array.from({ length: 20 }, (_, i) => ({
            timestamp: now - i * 1_000,
        }));
        expect(isLimitExceeded(records, now, ONE_HOUR, 20)).toBe(true);
    });

    it("createPaymentLink: 19 requests within an hour is still allowed", () => {
        const now = Date.now();
        const records: RateLimitRecord[] = Array.from({ length: 19 }, (_, i) => ({
            timestamp: now - i * 1_000,
        }));
        expect(isLimitExceeded(records, now, ONE_HOUR, 20)).toBe(false);
    });

    // key: inviteStaff:<orgId> — users/mutations.ts
    it("inviteStaff: 10th invite within an hour is blocked", () => {
        const now = Date.now();
        const records: RateLimitRecord[] = Array.from({ length: 10 }, (_, i) => ({
            timestamp: now - i * 1_000,
        }));
        expect(isLimitExceeded(records, now, ONE_HOUR, 10)).toBe(true);
    });

    it("inviteStaff: 9 invites within an hour is still allowed", () => {
        const now = Date.now();
        const records: RateLimitRecord[] = Array.from({ length: 9 }, (_, i) => ({
            timestamp: now - i * 1_000,
        }));
        expect(isLimitExceeded(records, now, ONE_HOUR, 10)).toBe(false);
    });

    it("rate limit resets after the window expires", () => {
        const now = Date.now();
        // All 20 records are from 2 hours ago — outside the 1-hour window
        const records: RateLimitRecord[] = Array.from({ length: 20 }, (_, i) => ({
            timestamp: now - 2 * ONE_HOUR - i * 1_000,
        }));
        expect(isLimitExceeded(records, now, ONE_HOUR, 20)).toBe(false);
    });

    it("partial window expiry: only unexpired records count toward the limit", () => {
        const now = Date.now();
        // 15 old (expired) + 5 recent (in window) → 5 active; limit 20 → allowed
        const expired = Array.from({ length: 15 }, (_, i) => ({
            timestamp: now - 2 * ONE_HOUR - i * 1_000,
        }));
        const recent = Array.from({ length: 5 }, (_, i) => ({
            timestamp: now - i * 1_000,
        }));
        expect(isLimitExceeded([...expired, ...recent], now, ONE_HOUR, 20)).toBe(false);
        // Same records but limit 5 → blocked
        expect(isLimitExceeded([...expired, ...recent], now, ONE_HOUR, 5)).toBe(true);
    });
});
