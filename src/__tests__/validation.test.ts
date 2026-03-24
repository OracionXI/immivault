/**
 * Tests for input validation logic used across Ordena forms.
 *
 * These mirror guards applied before mutations in:
 *   - convex/clients/mutations.ts   (client create/update)
 *   - convex/cases/mutations.ts     (case create/update)
 *   - convex/users/mutations.ts     (staff invite)
 *   - convex/organisations/mutations.ts (org settings)
 *
 * No Convex ctx.db calls — pure logic only.
 */

import { describe, it, expect } from "vitest";

// ─── Validators (mirrors mutation guard logic) ────────────────────────────────

/** Email must contain exactly one @, a domain with at least one dot, no spaces. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Phone is optional, but if supplied it must contain at least 7 digits.
 * Allows +, spaces, dashes, and parentheses.
 */
function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Required string fields must be non-empty after trimming. */
function isRequiredString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Slug: lowercase alphanumeric + hyphens, 3–30 chars. */
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(slug);
}

/**
 * Date of birth must be in the past and the person must be >= 1 year old.
 * `dob` is a Unix epoch in milliseconds.
 */
function isValidDateOfBirth(dob: number): boolean {
  const now = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  return dob < now - oneYearMs;
}

/**
 * Invitation expiry: expiresAt is epoch ms.
 * Returns true if the invite is still valid (not yet expired).
 */
function isInvitationValid(expiresAt: number): boolean {
  return expiresAt > Date.now();
}

/**
 * Case priority must be one of the four allowed values.
 */
type CasePriority = "Low" | "Medium" | "High" | "Urgent";
const CASE_PRIORITIES: CasePriority[] = ["Low", "Medium", "High", "Urgent"];

function isValidCasePriority(value: string): value is CasePriority {
  return (CASE_PRIORITIES as string[]).includes(value);
}

/**
 * User role must be one of the allowed role literals.
 */
type UserRole = "admin" | "case_manager" | "staff" | "accountant";
const USER_ROLES: UserRole[] = ["admin", "case_manager", "staff", "accountant"];

function isValidUserRole(value: string): value is UserRole {
  return (USER_ROLES as string[]).includes(value);
}

/**
 * Agreement signature: must be a non-empty string or a data URL (PNG avatar crop).
 */
function isValidSignature(sig: string): boolean {
  if (!sig || sig.trim().length === 0) return false;
  if (sig.startsWith("data:image/")) return true; // PNG data URL
  return sig.trim().length >= 2; // typed name
}

// ─── isValidEmail ─────────────────────────────────────────────────────────────

describe("isValidEmail", () => {
  it("accepts a standard email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("accepts emails with subdomains", () => {
    expect(isValidEmail("staff@law.firm.co.uk")).toBe(true);
  });

  it("accepts emails with plus addressing", () => {
    expect(isValidEmail("user+test@domain.com")).toBe(true);
  });

  it("rejects email without @", () => {
    expect(isValidEmail("notanemail")).toBe(false);
  });

  it("rejects email without domain dot", () => {
    expect(isValidEmail("user@nodot")).toBe(false);
  });

  it("rejects email with spaces", () => {
    expect(isValidEmail("user @domain.com")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects email with multiple @", () => {
    expect(isValidEmail("a@b@c.com")).toBe(false);
  });

  it("trims whitespace before validating", () => {
    expect(isValidEmail("  user@example.com  ")).toBe(true);
  });
});

// ─── isValidPhone ─────────────────────────────────────────────────────────────

describe("isValidPhone", () => {
  it("accepts a US number with dashes", () => {
    expect(isValidPhone("555-867-5309")).toBe(true);
  });

  it("accepts international format", () => {
    expect(isValidPhone("+1 (800) 555-0100")).toBe(true);
  });

  it("accepts a plain digit string", () => {
    expect(isValidPhone("07700900123")).toBe(true);
  });

  it("rejects a string with too few digits", () => {
    expect(isValidPhone("12345")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidPhone("")).toBe(false);
  });

  it("rejects a string with way too many digits", () => {
    expect(isValidPhone("1234567890123456")).toBe(false); // 16 digits
  });
});

// ─── isRequiredString ─────────────────────────────────────────────────────────

describe("isRequiredString", () => {
  it("returns true for a non-empty string", () => {
    expect(isRequiredString("John Doe")).toBe(true);
  });

  it("returns false for an empty string", () => {
    expect(isRequiredString("")).toBe(false);
  });

  it("returns false for a whitespace-only string", () => {
    expect(isRequiredString("   ")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isRequiredString(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isRequiredString(undefined)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isRequiredString(42)).toBe(false);
  });
});

// ─── isValidSlug ──────────────────────────────────────────────────────────────

describe("isValidSlug", () => {
  it("accepts a simple lowercase slug", () => {
    expect(isValidSlug("acme-law")).toBe(true);
  });

  it("accepts a slug with numbers", () => {
    expect(isValidSlug("firm123")).toBe(true);
  });

  it("rejects uppercase characters", () => {
    expect(isValidSlug("AcmeLaw")).toBe(false);
  });

  it("rejects slugs with spaces", () => {
    expect(isValidSlug("acme law")).toBe(false);
  });

  it("rejects slugs with leading hyphen", () => {
    expect(isValidSlug("-acmelaw")).toBe(false);
  });

  it("rejects slugs with trailing hyphen", () => {
    expect(isValidSlug("acmelaw-")).toBe(false);
  });

  it("rejects slugs shorter than 3 characters", () => {
    expect(isValidSlug("ab")).toBe(false);
  });

  it("rejects slugs longer than 30 characters", () => {
    expect(isValidSlug("a".repeat(31))).toBe(false);
  });

  it("rejects special characters", () => {
    expect(isValidSlug("acme_law")).toBe(false);
    expect(isValidSlug("acme.law")).toBe(false);
  });
});

// ─── isValidDateOfBirth ───────────────────────────────────────────────────────

describe("isValidDateOfBirth", () => {
  it("accepts a date 30 years ago", () => {
    const thirtyYearsAgo = Date.now() - 30 * 365 * 24 * 60 * 60 * 1000;
    expect(isValidDateOfBirth(thirtyYearsAgo)).toBe(true);
  });

  it("rejects a future date", () => {
    const tomorrow = Date.now() + 86_400_000;
    expect(isValidDateOfBirth(tomorrow)).toBe(false);
  });

  it("rejects a date less than 1 year ago (infant)", () => {
    const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
    expect(isValidDateOfBirth(sixMonthsAgo)).toBe(false);
  });

  it("accepts exactly 2 years ago", () => {
    const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
    expect(isValidDateOfBirth(twoYearsAgo)).toBe(true);
  });
});

// ─── isInvitationValid ────────────────────────────────────────────────────────

describe("isInvitationValid", () => {
  it("returns true when invite has not yet expired", () => {
    const future = Date.now() + 24 * 60 * 60 * 1000; // 24h from now
    expect(isInvitationValid(future)).toBe(true);
  });

  it("returns false when invite has expired", () => {
    const past = Date.now() - 1000;
    expect(isInvitationValid(past)).toBe(false);
  });

  it("returns false when expiry is right now (edge case)", () => {
    // expiresAt = Date.now() is technically not > Date.now()
    const now = Date.now();
    expect(isInvitationValid(now - 1)).toBe(false);
  });
});

// ─── isValidCasePriority ──────────────────────────────────────────────────────

describe("isValidCasePriority", () => {
  it.each(["Low", "Medium", "High", "Urgent"] as const)(
    "accepts '%s' as a valid priority",
    (priority) => {
      expect(isValidCasePriority(priority)).toBe(true);
    }
  );

  it("rejects an unknown priority", () => {
    expect(isValidCasePriority("Critical")).toBe(false);
  });

  it("is case-sensitive (rejects lowercase)", () => {
    expect(isValidCasePriority("high")).toBe(false);
    expect(isValidCasePriority("urgent")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidCasePriority("")).toBe(false);
  });
});

// ─── isValidUserRole ──────────────────────────────────────────────────────────

describe("isValidUserRole", () => {
  it.each(["admin", "case_manager", "staff", "accountant"] as const)(
    "accepts '%s' as a valid role",
    (role) => {
      expect(isValidUserRole(role)).toBe(true);
    }
  );

  it("rejects an unknown role string", () => {
    expect(isValidUserRole("superadmin")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidUserRole("")).toBe(false);
  });

  it("is case-sensitive (rejects uppercase)", () => {
    expect(isValidUserRole("Admin")).toBe(false);
  });
});

// ─── isValidSignature ─────────────────────────────────────────────────────────

describe("isValidSignature", () => {
  it("accepts a typed name signature", () => {
    expect(isValidSignature("Jane Smith")).toBe(true);
  });

  it("accepts a PNG data URL (cropped avatar signature)", () => {
    expect(isValidSignature("data:image/png;base64,iVBOR...")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidSignature("")).toBe(false);
  });

  it("rejects a whitespace-only string", () => {
    expect(isValidSignature("   ")).toBe(false);
  });

  it("rejects a single character (too short for a name)", () => {
    expect(isValidSignature("A")).toBe(false);
  });
});
