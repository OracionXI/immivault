/**
 * Tests for billing & invoice calculation logic.
 *
 * Mirrors the pure calculation helpers used across:
 *   - convex/billing/mutations.ts  (invoice creation, line items, tax)
 *   - convex/billing/queries.ts    (totals, outstanding balance)
 *
 * Convex ctx.db calls are not testable here — only the arithmetic
 * and formatting logic is validated. All monetary values are in
 * whole dollars (NOT cents) unless noted.
 */

import { describe, it, expect } from "vitest";

// ─── Types ────────────────────────────────────────────────────────────────────

type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number; // dollars
};

type Invoice = {
  items: LineItem[];
  taxRate: number;       // decimal, e.g. 0.1 = 10%
  discountAmount: number; // flat dollar discount
};

// ─── Helpers (mirrors billing logic) ─────────────────────────────────────────

function calcSubtotal(items: LineItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}

function calcTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * taxRate * 100) / 100;
}

function calcTotal(invoice: Invoice): number {
  const subtotal = calcSubtotal(invoice.items);
  const tax = calcTax(subtotal, invoice.taxRate);
  const total = subtotal + tax - invoice.discountAmount;
  return Math.max(0, Math.round(total * 100) / 100); // never negative
}

function calcOutstandingBalance(invoiceTotal: number, amountPaid: number): number {
  return Math.max(0, Math.round((invoiceTotal - amountPaid) * 100) / 100);
}

function generateInvoiceNumber(orgSlug: string, existingCount: number): string {
  return `${orgSlug.toUpperCase()}-INV-${String(existingCount + 1).padStart(4, "0")}`;
}

function isOverpaid(invoiceTotal: number, amountPaid: number): boolean {
  return amountPaid > invoiceTotal;
}

function getInvoiceStatus(total: number, amountPaid: number): "unpaid" | "partial" | "paid" {
  if (amountPaid <= 0) return "unpaid";
  if (amountPaid >= total) return "paid";
  return "partial";
}

// ─── calcSubtotal ─────────────────────────────────────────────────────────────

describe("calcSubtotal", () => {
  it("returns 0 for empty line items", () => {
    expect(calcSubtotal([])).toBe(0);
  });

  it("calculates single line item correctly", () => {
    expect(calcSubtotal([{ description: "Filing fee", quantity: 1, unitPrice: 500 }])).toBe(500);
  });

  it("multiplies quantity × unitPrice per item", () => {
    const items: LineItem[] = [{ description: "Hours", quantity: 3, unitPrice: 200 }];
    expect(calcSubtotal(items)).toBe(600);
  });

  it("sums multiple line items", () => {
    const items: LineItem[] = [
      { description: "Filing fee", quantity: 1, unitPrice: 500 },
      { description: "Translation", quantity: 2, unitPrice: 75 },
      { description: "Consultation", quantity: 3, unitPrice: 150 },
    ];
    // 500 + 150 + 450 = 1100
    expect(calcSubtotal(items)).toBe(1100);
  });

  it("handles fractional unit prices", () => {
    const items: LineItem[] = [{ description: "Service", quantity: 4, unitPrice: 12.5 }];
    expect(calcSubtotal(items)).toBe(50);
  });
});

// ─── calcTax ──────────────────────────────────────────────────────────────────

describe("calcTax", () => {
  it("calculates 10% tax correctly", () => {
    expect(calcTax(1000, 0.1)).toBe(100);
  });

  it("calculates 0% tax as zero", () => {
    expect(calcTax(1000, 0)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    // 333 × 0.1 = 33.3 — should be exactly 33.3
    expect(calcTax(333, 0.1)).toBe(33.3);
  });

  it("handles fractional tax rates (e.g. 8.5%)", () => {
    expect(calcTax(200, 0.085)).toBe(17);
  });

  it("calculates 20% VAT on $2500 correctly", () => {
    expect(calcTax(2500, 0.2)).toBe(500);
  });
});

// ─── calcTotal ────────────────────────────────────────────────────────────────

describe("calcTotal", () => {
  it("returns subtotal when tax=0 and discount=0", () => {
    const invoice: Invoice = {
      items: [{ description: "Fee", quantity: 1, unitPrice: 1000 }],
      taxRate: 0,
      discountAmount: 0,
    };
    expect(calcTotal(invoice)).toBe(1000);
  });

  it("adds tax to subtotal", () => {
    const invoice: Invoice = {
      items: [{ description: "Fee", quantity: 1, unitPrice: 1000 }],
      taxRate: 0.1,
      discountAmount: 0,
    };
    expect(calcTotal(invoice)).toBe(1100);
  });

  it("subtracts flat discount", () => {
    const invoice: Invoice = {
      items: [{ description: "Fee", quantity: 1, unitPrice: 1000 }],
      taxRate: 0,
      discountAmount: 150,
    };
    expect(calcTotal(invoice)).toBe(850);
  });

  it("applies tax then subtracts discount", () => {
    // subtotal=1000, tax=100, discount=50 → total=1050
    const invoice: Invoice = {
      items: [{ description: "Fee", quantity: 1, unitPrice: 1000 }],
      taxRate: 0.1,
      discountAmount: 50,
    };
    expect(calcTotal(invoice)).toBe(1050);
  });

  it("never returns a negative total (discount > subtotal+tax)", () => {
    const invoice: Invoice = {
      items: [{ description: "Fee", quantity: 1, unitPrice: 100 }],
      taxRate: 0,
      discountAmount: 500,
    };
    expect(calcTotal(invoice)).toBe(0);
  });

  it("returns 0 for empty invoice with no tax or discount", () => {
    const invoice: Invoice = { items: [], taxRate: 0, discountAmount: 0 };
    expect(calcTotal(invoice)).toBe(0);
  });
});

// ─── calcOutstandingBalance ───────────────────────────────────────────────────

describe("calcOutstandingBalance", () => {
  it("returns full invoice total when nothing paid", () => {
    expect(calcOutstandingBalance(1500, 0)).toBe(1500);
  });

  it("returns remainder after partial payment", () => {
    expect(calcOutstandingBalance(1500, 500)).toBe(1000);
  });

  it("returns 0 when fully paid", () => {
    expect(calcOutstandingBalance(1500, 1500)).toBe(0);
  });

  it("returns 0 when overpaid (no negative balance)", () => {
    expect(calcOutstandingBalance(1500, 2000)).toBe(0);
  });
});

// ─── isOverpaid ───────────────────────────────────────────────────────────────

describe("isOverpaid", () => {
  it("returns false when paid is less than total", () => {
    expect(isOverpaid(1000, 900)).toBe(false);
  });

  it("returns false when paid equals total", () => {
    expect(isOverpaid(1000, 1000)).toBe(false);
  });

  it("returns true when paid exceeds total", () => {
    expect(isOverpaid(1000, 1001)).toBe(true);
  });
});

// ─── getInvoiceStatus ─────────────────────────────────────────────────────────

describe("getInvoiceStatus", () => {
  it("returns 'unpaid' when nothing has been paid", () => {
    expect(getInvoiceStatus(1000, 0)).toBe("unpaid");
  });

  it("returns 'partial' when partially paid", () => {
    expect(getInvoiceStatus(1000, 400)).toBe("partial");
  });

  it("returns 'paid' when fully paid", () => {
    expect(getInvoiceStatus(1000, 1000)).toBe("paid");
  });

  it("returns 'paid' when overpaid", () => {
    expect(getInvoiceStatus(1000, 1200)).toBe("paid");
  });
});

// ─── generateInvoiceNumber ────────────────────────────────────────────────────

describe("generateInvoiceNumber", () => {
  it("follows the ORG-INV-XXXX format", () => {
    expect(generateInvoiceNumber("acme", 0)).toMatch(/^ACME-INV-\d{4}$/);
  });

  it("uppercases the org slug", () => {
    expect(generateInvoiceNumber("lawfirm", 0)).toMatch(/^LAWFIRM-INV-/);
  });

  it("pads sequence to 4 digits", () => {
    expect(generateInvoiceNumber("org", 0)).toMatch(/-0001$/);
    expect(generateInvoiceNumber("org", 9)).toMatch(/-0010$/);
    expect(generateInvoiceNumber("org", 999)).toMatch(/-1000$/);
  });

  it("generates unique invoice numbers for consecutive calls", () => {
    const numbers = new Set(
      Array.from({ length: 50 }, (_, i) => generateInvoiceNumber("firm", i))
    );
    expect(numbers.size).toBe(50);
  });
});
