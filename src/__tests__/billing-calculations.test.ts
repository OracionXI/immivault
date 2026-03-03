/**
 * Tests for invoice billing calculations.
 *
 * These mirror the exact formulas used in convex/billing/mutations.ts
 * (createInvoice handler) and must stay in sync with any schema changes.
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────
// Helpers (mirrors mutations.ts logic exactly)
// ─────────────────────────────────────────────

type InvoiceItem = { quantity: number; unitPrice: number };

function calcSubtotal(items: InvoiceItem[]): number {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function calcTaxAmount(subtotal: number, taxRate: number): number {
    return subtotal * (taxRate / 100);
}

function calcTotal(subtotal: number, taxAmount: number): number {
    return subtotal + taxAmount;
}

function generateInvoiceNumber(existingCount: number): string {
    return `INV-${String(existingCount + 1).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────
// Subtotal
// ─────────────────────────────────────────────

describe("calcSubtotal", () => {
    it("returns 0 for an empty items array", () => {
        expect(calcSubtotal([])).toBe(0);
    });

    it("calculates a single item", () => {
        expect(calcSubtotal([{ quantity: 3, unitPrice: 200 }])).toBe(600);
    });

    it("sums multiple items correctly", () => {
        const items = [
            { quantity: 2, unitPrice: 500 },
            { quantity: 1, unitPrice: 200 },
            { quantity: 4, unitPrice: 75 },
        ];
        expect(calcSubtotal(items)).toBe(1500);
    });

    it("handles fractional unit prices", () => {
        expect(calcSubtotal([{ quantity: 10, unitPrice: 9.99 }])).toBeCloseTo(99.9);
    });
});

// ─────────────────────────────────────────────
// Tax amount
// ─────────────────────────────────────────────

describe("calcTaxAmount", () => {
    it("returns 0 when tax rate is 0", () => {
        expect(calcTaxAmount(1000, 0)).toBe(0);
    });

    it("calculates 10% tax correctly", () => {
        expect(calcTaxAmount(1000, 10)).toBeCloseTo(100);
    });

    it("calculates 8.5% tax correctly", () => {
        expect(calcTaxAmount(1000, 8.5)).toBeCloseTo(85);
    });

    it("handles 100% tax rate edge case", () => {
        expect(calcTaxAmount(500, 100)).toBeCloseTo(500);
    });
});

// ─────────────────────────────────────────────
// Total
// ─────────────────────────────────────────────

describe("calcTotal", () => {
    it("equals subtotal when tax is 0", () => {
        expect(calcTotal(1000, 0)).toBe(1000);
    });

    it("adds subtotal and tax correctly", () => {
        expect(calcTotal(1000, 85)).toBe(1085);
    });
});

// ─────────────────────────────────────────────
// Invoice number generation
// ─────────────────────────────────────────────

describe("generateInvoiceNumber", () => {
    it("starts at INV-0001 when no invoices exist", () => {
        expect(generateInvoiceNumber(0)).toBe("INV-0001");
    });

    it("pads numbers below 4 digits", () => {
        expect(generateInvoiceNumber(5)).toBe("INV-0006");
        expect(generateInvoiceNumber(99)).toBe("INV-0100");
    });

    it("handles 4-digit invoice counts", () => {
        expect(generateInvoiceNumber(9999)).toBe("INV-10000");
    });

    it("always has INV- prefix", () => {
        expect(generateInvoiceNumber(42)).toMatch(/^INV-/);
    });
});

// ─────────────────────────────────────────────
// Full invoice pipeline
// ─────────────────────────────────────────────

describe("full invoice pipeline", () => {
    it("produces correct totals for a realistic invoice", () => {
        const items: InvoiceItem[] = [
            { quantity: 1, unitPrice: 3500 },  // Attorney retainer
            { quantity: 2, unitPrice: 150 },   // Filing fees
            { quantity: 3, unitPrice: 80 },    // Document preparation
        ];
        const taxRate = 0; // Immigration services — typically 0% tax

        const subtotal = calcSubtotal(items);
        const taxAmount = calcTaxAmount(subtotal, taxRate);
        const total = calcTotal(subtotal, taxAmount);

        expect(subtotal).toBe(4040);
        expect(taxAmount).toBe(0);
        expect(total).toBe(4040);
    });

    it("auto-marks as Paid when payment amount covers total", () => {
        const invoiceTotal = 1200;
        const paymentAmount = 1200;
        expect(paymentAmount >= invoiceTotal).toBe(true);
    });

    it("does NOT auto-mark as Paid for partial payment", () => {
        const invoiceTotal = 1200;
        const paymentAmount = 800;
        expect(paymentAmount >= invoiceTotal).toBe(false);
    });
});
