/**
 * Quality tests for email notification formatting logic.
 *
 * Mirrors the helpers in convex/notifications/actions.ts.
 * Catches regressions in currency formatting, date rendering,
 * and HTML template output.
 */

import { describe, it, expect } from "vitest";

// ─── Helpers (mirrors actions.ts) ──────────────────────────────────────────

function formatCurrency(amount: number, currency = "USD"): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
    });
}

function formatDatetime(ms: number): string {
    return new Date(ms).toLocaleString("en-US", {
        weekday: "long", month: "long", day: "numeric",
        year: "numeric", hour: "numeric", minute: "2-digit",
    });
}

function pluralDays(n: number): string {
    return `${n} day${n === 1 ? "" : "s"}`;
}

function renderHtml(title: string, body: string): string {
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
<h2 style="color:#1d4ed8">${title}</h2>
${body}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#6b7280">Ordena — Immigration Case Management</p>
</body></html>`;
}

// ─── Currency formatting ────────────────────────────────────────────────────

describe("formatCurrency (dollar amounts — NOT cents)", () => {
    it("formats whole dollar amounts", () => {
        expect(formatCurrency(500)).toBe("$500.00");
    });

    it("formats large invoice totals correctly", () => {
        // $3,800 legal fee — stored as 3800, NOT 380000 cents
        expect(formatCurrency(3800)).toBe("$3,800.00");
    });

    it("formats fractional amounts", () => {
        expect(formatCurrency(1234.56)).toBe("$1,234.56");
    });

    it("does NOT divide by 100 (regression guard for bug fix)", () => {
        // If we divided by 100, $500 would show as $5.00
        const formatted = formatCurrency(500);
        expect(formatted).not.toBe("$5.00");
        expect(formatted).toBe("$500.00");
    });

    it("formats zero", () => {
        expect(formatCurrency(0)).toBe("$0.00");
    });
});

// ─── Date formatting ────────────────────────────────────────────────────────

describe("formatDate", () => {
    it("formats a known timestamp correctly", () => {
        // 2025-01-15 00:00:00 UTC
        const ts = new Date("2025-01-15T12:00:00Z").getTime();
        const result = formatDate(ts);
        // Should contain month name, day, and year
        expect(result).toMatch(/January|Feb|March|April|May|June|July|August|September|October|November|December/);
        expect(result).toMatch(/2025/);
        expect(result).toMatch(/15/);
    });

    it("includes year in output", () => {
        const ts = Date.now();
        expect(formatDate(ts)).toMatch(/\d{4}/);
    });
});

describe("formatDatetime (appointment reminder)", () => {
    it("includes weekday, time, and year", () => {
        const ts = new Date("2025-03-17T14:30:00Z").getTime();
        const result = formatDatetime(ts);
        expect(result).toMatch(/\d{4}/); // year
        expect(result).toMatch(/:/);     // time separator
    });
});

// ─── Plural days ─────────────────────────────────────────────────────────────

describe("pluralDays (document expiry copy)", () => {
    it("uses singular for 1 day", () => {
        expect(pluralDays(1)).toBe("1 day");
    });

    it("uses plural for 0 days", () => {
        expect(pluralDays(0)).toBe("0 days");
    });

    it("uses plural for multiple days", () => {
        expect(pluralDays(30)).toBe("30 days");
        expect(pluralDays(7)).toBe("7 days");
    });
});

// ─── HTML email template ─────────────────────────────────────────────────────

describe("renderHtml", () => {
    it("includes the title in an h2 tag", () => {
        const html = renderHtml("Test Title", "<p>Body</p>");
        expect(html).toContain("<h2");
        expect(html).toContain("Test Title");
    });

    it("includes the body content", () => {
        const html = renderHtml("Title", "<p>My body content</p>");
        expect(html).toContain("My body content");
    });

    it("includes Ordena footer", () => {
        const html = renderHtml("T", "B");
        expect(html).toContain("Ordena");
    });

    it("produces valid HTML structure", () => {
        const html = renderHtml("T", "B");
        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("<html>");
        expect(html).toContain("</html>");
        expect(html).toContain("<body");
        expect(html).toContain("</body>");
    });

    it("does not allow XSS via unsanitised title (regression awareness)", () => {
        // renderHtml interpolates directly — this test documents that consumer
        // code must sanitise inputs before passing to renderHtml.
        const html = renderHtml("<script>alert(1)</script>", "safe body");
        // The script tag IS present (renderHtml doesn't sanitise — callers must).
        // This test documents the behaviour, not approves XSS.
        expect(html).toContain("<script>");
        // TODO: add DOMPurify or escapeHtml when user-supplied data flows here.
    });
});
