import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Multi-tenancy ───────────────────────────────────────────────────────────
  organisations: defineTable({
    name: v.string(),
    slug: v.string(),
    plan: v.string(), // "free" | "pro" | "enterprise"
    clerkOrgId: v.string(),
  })
    .index("by_clerk_org", ["clerkOrgId"])
    .index("by_slug", ["slug"]),

  // ─── Users (staff members) ────────────────────────────────────────────────────
  users: defineTable({
    organisationId: v.id("organisations"),
    clerkUserId: v.string(),
    // tokenIdentifier = the JWT subject used to look up users in auth wrappers
    tokenIdentifier: v.string(),
    email: v.string(),
    fullName: v.string(),
    avatarUrl: v.optional(v.string()),
    role: v.union(
      v.literal("admin"),
      v.literal("attorney"),
      v.literal("paralegal"),
      v.literal("staff")
    ),
    status: v.union(v.literal("active"), v.literal("inactive")),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_org", ["organisationId"])
    .index("by_clerk_user", ["clerkUserId"]),

  // ─── Clients ──────────────────────────────────────────────────────────────────
  clients: defineTable({
    organisationId: v.id("organisations"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    nationality: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    address: v.optional(v.string()),
    status: v.union(
      v.literal("Active"),
      v.literal("Pending"),
      v.literal("Inactive"),
      v.literal("Archived")
    ),
    assignedTo: v.id("users"),
  })
    .index("by_org", ["organisationId"])
    .index("by_org_and_status", ["organisationId", "status"])
    .index("by_assigned", ["assignedTo"]),

  // ─── Cases ────────────────────────────────────────────────────────────────────
  cases: defineTable({
    organisationId: v.id("organisations"),
    caseNumber: v.string(),
    title: v.string(),
    clientId: v.id("clients"),
    visaType: v.string(),
    status: v.union(
      v.literal("Active"),
      v.literal("Pending"),
      v.literal("On Hold"),
      v.literal("Completed"),
      v.literal("Rejected")
    ),
    priority: v.union(
      v.literal("Low"),
      v.literal("Medium"),
      v.literal("High"),
      v.literal("Urgent")
    ),
    assignedTo: v.id("users"),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    deadline: v.optional(v.number()),
  })
    .index("by_org", ["organisationId"])
    .index("by_client", ["clientId"])
    .index("by_org_and_status", ["organisationId", "status"])
    .index("by_assigned", ["assignedTo"]),

  // ─── Tasks ────────────────────────────────────────────────────────────────────
  tasks: defineTable({
    organisationId: v.id("organisations"),
    title: v.string(),
    description: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
    assignedTo: v.id("users"),
    status: v.union(
      v.literal("To Do"),
      v.literal("In Progress"),
      v.literal("In Review"),
      v.literal("Completed")
    ),
    priority: v.union(
      v.literal("Low"),
      v.literal("Medium"),
      v.literal("High"),
      v.literal("Urgent")
    ),
    dueDate: v.optional(v.number()),
  })
    .index("by_org", ["organisationId"])
    .index("by_case", ["caseId"])
    .index("by_org_and_status", ["organisationId", "status"])
    .index("by_assigned", ["assignedTo"]),

  // ─── Documents ────────────────────────────────────────────────────────────────
  documents: defineTable({
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    name: v.string(),
    type: v.union(
      v.literal("Identity"),
      v.literal("Employment"),
      v.literal("Immigration"),
      v.literal("Education"),
      v.literal("Financial"),
      v.literal("Supporting")
    ),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
    status: v.union(
      v.literal("Pending"),
      v.literal("Verified"),
      v.literal("Expired"),
      v.literal("Rejected")
    ),
    expiryDate: v.optional(v.number()),
    uploadedBy: v.id("users"),
  })
    .index("by_org", ["organisationId"])
    .index("by_client", ["clientId"])
    .index("by_case", ["caseId"]),

  // ─── Appointments ─────────────────────────────────────────────────────────────
  appointments: defineTable({
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    assignedTo: v.id("users"),
    title: v.string(),
    type: v.union(
      v.literal("Consultation"),
      v.literal("Document Review"),
      v.literal("Interview Prep"),
      v.literal("Follow-up")
    ),
    status: v.union(
      v.literal("Scheduled"),
      v.literal("Confirmed"),
      v.literal("Completed"),
      v.literal("Cancelled")
    ),
    startAt: v.number(),
    endAt: v.number(),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_org", ["organisationId"])
    .index("by_client", ["clientId"])
    .index("by_org_and_status", ["organisationId", "status"]),

  // ─── Invoices ─────────────────────────────────────────────────────────────────
  invoices: defineTable({
    organisationId: v.id("organisations"),
    invoiceNumber: v.string(),
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    status: v.union(
      v.literal("Draft"),
      v.literal("Sent"),
      v.literal("Paid"),
      v.literal("Overdue")
    ),
    subtotal: v.number(),
    taxRate: v.number(),
    taxAmount: v.number(),
    total: v.number(),
    dueDate: v.number(),
    issuedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_org", ["organisationId"])
    .index("by_client", ["clientId"])
    .index("by_org_and_status", ["organisationId", "status"]),

  // ─── Invoice Line Items ───────────────────────────────────────────────────────
  invoiceItems: defineTable({
    invoiceId: v.id("invoices"),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    total: v.number(),
  }).index("by_invoice", ["invoiceId"]),

  // ─── Payments ─────────────────────────────────────────────────────────────────
  payments: defineTable({
    organisationId: v.id("organisations"),
    invoiceId: v.id("invoices"),
    clientId: v.id("clients"),
    amount: v.number(),
    currency: v.string(),
    method: v.union(
      v.literal("Card"),
      v.literal("Bank Transfer"),
      v.literal("Cash"),
      v.literal("Check"),
      v.literal("Online")
    ),
    status: v.union(
      v.literal("Completed"),
      v.literal("Pending"),
      v.literal("Failed"),
      v.literal("Refunded")
    ),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    paidAt: v.number(),
  })
    .index("by_org", ["organisationId"])
    .index("by_invoice", ["invoiceId"]),

  // ─── Payment Links ────────────────────────────────────────────────────────────
  paymentLinks: defineTable({
    organisationId: v.id("organisations"),
    invoiceId: v.optional(v.id("invoices")),
    clientId: v.id("clients"),
    amount: v.number(),
    description: v.string(),
    status: v.union(
      v.literal("Active"),
      v.literal("Expired"),
      v.literal("Used")
    ),
    urlToken: v.string(),
    expiresAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_token", ["urlToken"])
    .index("by_org", ["organisationId"]),

  // ─── Comments (polymorphic — cases and tasks) ─────────────────────────────────
  comments: defineTable({
    organisationId: v.id("organisations"),
    entityType: v.union(v.literal("case"), v.literal("task")),
    entityId: v.string(),
    authorId: v.id("users"),
    body: v.string(),
  }).index("by_entity", ["entityType", "entityId"]),

  // ─── Organisation Settings ────────────────────────────────────────────────────
  organisationSettings: defineTable({
    organisationId: v.id("organisations"),
    caseStages: v.optional(v.array(v.string())),
    defaultCurrency: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    emailFromName: v.optional(v.string()),
    emailFromAddress: v.optional(v.string()),
    bookingEnabled: v.optional(v.boolean()),
    bookingUrl: v.optional(v.string()),
  }).index("by_org", ["organisationId"]),
});
