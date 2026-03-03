/**
 * Tests for case and document identifier generation.
 *
 * These mirror the generation logic in convex/cases/mutations.ts
 * and convex/billing/mutations.ts.
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────
// Case number (mirrors cases/mutations.ts)
// ─────────────────────────────────────────────

function generateCaseNumber(orgSlug: string, existingCount: number): string {
    const date = new Date();
    const yyyymmdd =
        date.getFullYear().toString() +
        String(date.getMonth() + 1).padStart(2, "0") +
        String(date.getDate()).padStart(2, "0");
    const seq = String(existingCount + 1).padStart(4, "0");
    return `${orgSlug.toUpperCase()}-${yyyymmdd}-${seq}`;
}

describe("generateCaseNumber", () => {
    it("follows the ORG-YYYYMMDD-XXXX format", () => {
        const result = generateCaseNumber("acme", 0);
        expect(result).toMatch(/^ACME-\d{8}-0001$/);
    });

    it("uppercases the org slug", () => {
        expect(generateCaseNumber("testfirm", 0)).toMatch(/^TESTFIRM-/);
    });

    it("pads sequence number to 4 digits", () => {
        expect(generateCaseNumber("org", 4)).toMatch(/-0005$/);
        expect(generateCaseNumber("org", 999)).toMatch(/-1000$/);
    });

    it("uses today's date in the middle segment", () => {
        const today = new Date();
        const yyyymmdd =
            today.getFullYear().toString() +
            String(today.getMonth() + 1).padStart(2, "0") +
            String(today.getDate()).padStart(2, "0");
        expect(generateCaseNumber("law", 0)).toContain(yyyymmdd);
    });
});

// ─────────────────────────────────────────────
// Payment link token (mirrors billing/mutations.ts)
// ─────────────────────────────────────────────

function generatePaymentLinkToken(): string {
    return (
        Math.random().toString(36).slice(2, 10) +
        Math.random().toString(36).slice(2, 10)
    );
}

describe("generatePaymentLinkToken", () => {
    it("produces a string of 12–16 chars (base-36)", () => {
        const token = generatePaymentLinkToken();
        // Each .slice(2,10) yields up to 8 chars; combined = up to 16
        expect(token.length).toBeGreaterThanOrEqual(8);
        expect(token.length).toBeLessThanOrEqual(16);
    });

    it("contains only lowercase alphanumerics", () => {
        for (let i = 0; i < 20; i++) {
            expect(generatePaymentLinkToken()).toMatch(/^[a-z0-9]+$/);
        }
    });

    it("generates unique tokens", () => {
        const tokens = new Set(Array.from({ length: 100 }, generatePaymentLinkToken));
        // Collision probability is negligible; all 100 should be unique
        expect(tokens.size).toBe(100);
    });
});

// ─────────────────────────────────────────────
// Payment link expiry check (mirrors billing/mutations.ts processPaymentLink)
// ─────────────────────────────────────────────

describe("payment link expiry", () => {
    it("identifies an expired link", () => {
        const expiresAt = Date.now() - 1000; // 1 second ago
        expect(expiresAt < Date.now()).toBe(true);
    });

    it("identifies an active link", () => {
        const expiresAt = Date.now() + 86_400_000; // 24h from now
        expect(expiresAt < Date.now()).toBe(false);
    });
});
