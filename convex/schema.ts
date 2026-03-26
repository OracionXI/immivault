import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Multi-tenancy ───────────────────────────────────────────────────────────
  organisations: defineTable({
    name: v.string(),
    slug: v.string(),
    plan: v.string(), // "free" | "pro" | "enterprise"
    agreementSignature: v.optional(v.string()),  // typed name or PNG data URL
    agreementSignedAt: v.optional(v.number()),   // epoch ms
    deletedAt: v.optional(v.number()),           // epoch ms; set on soft-delete
    portalSlug: v.optional(v.string()),          // unique portal URL slug e.g. "smith-law"
    portalEnabled: v.optional(v.boolean()),      // whether the client portal is active
  })
    .index("by_slug", ["slug"])
    .index("by_deleted_at", ["deletedAt"])
    .index("by_portal_slug", ["portalSlug"]),

  // ─── Staff Invitations ────────────────────────────────────────────────────
  invitations: defineTable({
    organisationId: v.id("organisations"),
    email: v.string(),
    role: v.union(v.literal("case_manager"), v.literal("staff"), v.literal("accountant")),
    roleId: v.optional(v.string()), // custom role ID (UUID or built-in key)
    invitedBy: v.id("users"),
    clerkInvitationId: v.optional(v.string()),
    used: v.boolean(),
    expiresAt: v.number(),
  })
    .index("by_org", ["organisationId"])
    .index("by_email", ["email"]),

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
      v.literal("case_manager"),
      v.literal("staff"),
      v.literal("accountant")
    ),
    roleId: v.optional(v.string()), // display role ID (custom UUID or built-in key)
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("pending_onboarding")
    ),
    // Google Calendar OAuth — set when user connects their Google account
    googleRefreshToken: v.optional(v.string()),
    googleEmail: v.optional(v.string()),
    googleConnectedAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_org", ["organisationId"])
    .index("by_clerk_user", ["clerkUserId"]),

  // ─── Clients ──────────────────────────────────────────────────────────────────
  clients: defineTable({
    organisationId: v.id("organisations"),
    prefix: v.optional(v.string()),          // Mr. / Mrs. / Ms. / Dr. / Esq.
    firstName: v.string(),
    middleName: v.optional(v.string()),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    mobilePhone: v.optional(v.string()),
    nationality: v.optional(v.string()),     // country of citizenship
    countryOfBirth: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),     // epoch ms
    maritalStatus: v.optional(v.string()),   // Single / Married / Divorced / Widowed / Separated
    passportNumber: v.optional(v.string()),
    languagePreference: v.optional(v.string()),
    address: v.optional(v.string()),
    referralSource: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("Active"),
      v.literal("Inactive"),
      v.literal("Archived")
    ),
    assignedTo: v.optional(v.id("users")),
    contractAmount: v.optional(v.number()),  // in cents; the signed contract total
    portalEnabled: v.optional(v.boolean()),    // whether this client can access the portal
    lastPortalLogin: v.optional(v.number()),   // epoch ms of last portal login
    profileCompleted: v.optional(v.boolean()), // true after client completes portal onboarding wizard
  })
    .index("by_org", ["organisationId"])
    .index("by_org_and_status", ["organisationId", "status"])
    .index("by_org_and_email", ["organisationId", "email"])
    .index("by_assigned", ["assignedTo"]),

  // ─── Cases ────────────────────────────────────────────────────────────────────
  cases: defineTable({
    organisationId: v.id("organisations"),
    caseNumber: v.string(),
    title: v.string(),
    clientId: v.id("clients"),
    visaType: v.string(),
    issue: v.optional(v.string()),
    status: v.string(),                               // custom stage name (set by org in settings)
    priority: v.union(
      v.literal("Low"),
      v.literal("Medium"),
      v.literal("High"),
      v.literal("Urgent")
    ),
    assignedTo: v.optional(v.id("users")),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    deadline: v.optional(v.number()),
    completedAt: v.optional(v.number()),              // set when status → Completed
    archivedReportStorageId: v.optional(v.id("_storage")), // PDF stored after archival
    deadlineNotifiedAt: v.optional(v.number()),       // set after 48h deadline notification sent
    updatedAt: v.optional(v.number()),                // epoch ms of last user-triggered update
    updatedBy: v.optional(v.id("users")),             // user who last updated
  })
    .index("by_org", ["organisationId"])
    .index("by_client", ["clientId"])
    .index("by_org_and_status", ["organisationId", "status"])
    .index("by_assigned", ["assignedTo"]),

  // ─── Tasks ────────────────────────────────────────────────────────────────────
  tasks: defineTable({
    organisationId: v.id("organisations"),
    taskId: v.string(),                               // human-readable e.g. TASK-0001
    title: v.string(),
    description: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
    assignedTo: v.optional(v.id("users")),
    status: v.union(
      v.literal("To Do"),
      v.literal("In Progress"),
      v.literal("In Review"),
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
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),              // set when status → Completed
    hidden: v.optional(v.boolean()),                  // true when parent client is Archived
    updatedAt: v.optional(v.number()),                // epoch ms of last user-triggered update
    updatedBy: v.optional(v.id("users")),             // user who last updated
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
    type: v.optional(v.string()),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
    // Verified = default on upload; Expired = set when the linked case completes
    status: v.union(v.literal("Verified"), v.literal("Expired")),
    uploadedBy: v.id("users"),
  })
    .index("by_org", ["organisationId"])
    .index("by_client", ["clientId"])
    .index("by_case", ["caseId"]),

  // ─── Appointments ─────────────────────────────────────────────────────────────
  appointments: defineTable({
    organisationId: v.id("organisations"),
    // clientId is optional — General Meetings don't require a client
    clientId: v.optional(v.id("clients")),
    caseId: v.optional(v.id("cases")),
    // assignedTo = the host (case manager or admin who owns the meeting)
    assignedTo: v.optional(v.id("users")),
    // createdBy = who created it (used for edit/cancel permission checks); optional for portal-created appointments
    createdBy: v.optional(v.id("users")),
    title: v.string(),
    meetingType: v.union(
      v.literal("case_appointment"),
      v.literal("general_meeting")
    ),
    // Appointment type is user-configurable via Settings → Appt Types; stored as a plain string.
    type: v.string(),
    // Upcoming → Ongoing (auto when startAt passes) → Expired (auto when endAt passes)
    // Cancelled is set manually; deletedAt is set on cancel/expire for soft-delete
    status: v.union(
      v.literal("Upcoming"),
      v.literal("Ongoing"),
      v.literal("Expired"),
      v.literal("Cancelled")
    ),
    startAt: v.number(),
    endAt: v.number(),
    // attendees: mix of internal staff and external people (clients, external contacts)
    attendees: v.optional(v.array(v.object({
      type: v.union(v.literal("internal"), v.literal("external")),
      userId: v.optional(v.id("users")),   // set for internal attendees
      email: v.string(),
      name: v.string(),
    }))),
    // Google Calendar integration
    googleMeetLink: v.optional(v.string()),
    googleEventId: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Soft delete: set on cancel or expire; hard-deleted after 40 days by cron
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["organisationId"])
    .index("by_client", ["clientId"])
    .index("by_org_and_status", ["organisationId", "status"])
    .index("by_assigned", ["assignedTo"])
    .index("by_created_by", ["createdBy"])
    .index("by_deleted_at", ["deletedAt"])
    .index("by_org_and_start", ["organisationId", "startAt"]),

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
    createdBy: v.optional(v.id("users")),      // optional for system-generated invoices (cron/webhook)
    paidAmount: v.optional(v.number()),        // dollars; running total paid toward this invoice
    isContractDraft: v.optional(v.boolean()),  // true = auto-created from client contractAmount
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
    invoiceId: v.optional(v.id("invoices")), // optional — standalone payment links have no invoice
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
    stripePaymentIntentId: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
  })
    .index("by_org", ["organisationId"])
    .index("by_invoice", ["invoiceId"])
    .index("by_stripe_intent", ["organisationId", "stripePaymentIntentId"]),

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
    paymentType: v.optional(v.union(
      v.literal("Full Amount"),
      v.literal("Installment"),
      v.literal("Deposit"),
      v.literal("Partial"),
    )),
    urlToken: v.string(),
    expiresAt: v.number(),
    createdBy: v.optional(v.id("users")),              // undefined for portal-initiated links
    caseId: v.optional(v.id("cases")),
    nextPaymentDate: v.optional(v.number()),           // epoch ms; when next installment is due
    nextPaymentOverdueCreated: v.optional(v.boolean()), // true once overdue invoice generated for this link
    // Portal appointment booking fields
    appointmentPricingId: v.optional(v.id("appointmentPricing")),
    pendingAppointmentAt: v.optional(v.number()),      // epoch ms; requested start time
    pendingAppointmentDuration: v.optional(v.number()), // minutes
  })
    .index("by_token", ["urlToken"])
    .index("by_org", ["organisationId"]),

  // ─── Comments (polymorphic — cases and tasks) ─────────────────────────────────
  comments: defineTable({
    organisationId: v.id("organisations"),
    entityType: v.union(v.literal("case"), v.literal("task")),
    entityId: v.string(),
    authorId: v.optional(v.id("users")),         // staff author (undefined for portal comments)
    authorClientId: v.optional(v.id("clients")), // portal client author
    body: v.string(),
    visibility: v.optional(v.union(v.literal("internal"), v.literal("external"))),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_org", ["organisationId"]),

  // ─── Bank Accounts ────────────────────────────────────────────────────────────
  bankAccounts: defineTable({
    organisationId: v.id("organisations"),
    bankName: v.string(),
    accountName: v.string(),
    accountNumber: v.string(),
    routingNumber: v.string(),
    currency: v.optional(v.string()), // e.g. "USD", defaults to org default
    isDefault: v.boolean(),
  }).index("by_org", ["organisationId"]),

  // ─── Bank Transactions ────────────────────────────────────────────────────────
  bankTransactions: defineTable({
    organisationId: v.id("organisations"),
    bankAccountId: v.id("bankAccounts"),
    type: v.union(v.literal("money_in"), v.literal("money_out")),
    amount: v.number(), // in cents
    currency: v.string(),
    description: v.string(),
    reference: v.optional(v.string()),
    date: v.number(), // unix timestamp ms
    notes: v.optional(v.string()),
  })
    .index("by_org", ["organisationId"])
    .index("by_account", ["bankAccountId"]),

  // ─── Invoice Counters (atomic per-org counter to prevent duplicate invoice numbers) ─
  invoiceCounters: defineTable({
    organisationId: v.id("organisations"),
    nextNumber: v.number(), // starts at 1, incremented atomically on each use
  }).index("by_org", ["organisationId"]),

  // ─── Client Portal — Magic Links ─────────────────────────────────────────────
  portalMagicLinks: defineTable({
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    tokenHash: v.string(),            // SHA-256(rawToken) hex — never store raw
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),   // set when consumed (single-use)
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_client", ["clientId"]),

  // ─── Client Portal — OTP Codes ────────────────────────────────────────────────
  portalOtpCodes: defineTable({
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    codeHash: v.string(),             // SHA-256(6-digit code) hex
    expiresAt: v.number(),
    attempts: v.number(),             // failed-attempt counter (lockout at 5)
    usedAt: v.optional(v.number()),
  })
    .index("by_client", ["clientId"]),

  // ─── Client Portal — Sessions ─────────────────────────────────────────────────
  portalSessions: defineTable({
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    sessionHash: v.string(),          // SHA-256(rawSessionToken) hex
    expiresAt: v.number(),
    lastSeenAt: v.number(),
    userAgent: v.optional(v.string()),
  })
    .index("by_session_hash", ["sessionHash"])
    .index("by_client", ["clientId"]),

  // ─── Appointment Pricing ──────────────────────────────────────────────────────
  appointmentPricing: defineTable({
    organisationId: v.id("organisations"),
    appointmentType: v.string(),      // matches appointmentTypes in settings
    priceInCents: v.number(),
    currency: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_org", ["organisationId"]),

  // ─── Client Portal — Notifications ───────────────────────────────────────────
  portalNotifications: defineTable({
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    type: v.string(),                 // "case_update" | "invoice_created" | "payment_received" | "appointment_confirmed"
    title: v.string(),
    message: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    read: v.boolean(),
  })
    .index("by_client", ["clientId"])
    .index("by_client_unread", ["clientId", "read"]),

  // ─── Rate Limits (fixed-window counter, server-side only) ────────────────────
  rateLimits: defineTable({
    key: v.string(),       // e.g. "inviteStaff:<orgId>"
    timestamp: v.number(), // ms epoch — start of the current fixed window
    count: v.optional(v.number()), // number of requests in this window
  }).index("by_key", ["key"]),

  // ─── Notifications ────────────────────────────────────────────────────────────
  notifications: defineTable({
    organisationId: v.id("organisations"),
    recipientId: v.id("users"),
    type: v.union(
      v.literal("case_created"),
      v.literal("case_assigned"),
      v.literal("case_status_changed"),
      v.literal("case_deadline"),
      v.literal("case_updated"),
      v.literal("task_assigned"),
      v.literal("task_status_changed"),
      v.literal("task_overdue"),
      v.literal("task_updated"),
      v.literal("comment"),
      v.literal("mention"),
      v.literal("document_uploaded"),
      v.literal("appointment_created"),
      v.literal("appointment_updated"),
      v.literal("appointment_cancelled"),
      v.literal("payment_dispute")
    ),
    title: v.string(),
    message: v.string(),
    entityType: v.optional(v.union(v.literal("case"), v.literal("task"), v.literal("appointment"))),
    entityId: v.optional(v.string()),
    read: v.boolean(),
  })
    .index("by_recipient", ["recipientId"])
    .index("by_recipient_unread", ["recipientId", "read"])
    .index("by_org", ["organisationId"]),

  // ─── Organisation Settings ────────────────────────────────────────────────────
  organisationSettings: defineTable({
    organisationId: v.id("organisations"),
    caseStages: v.optional(v.array(v.string())),
    caseColumnOrder: v.optional(v.array(v.string())), // full ordered column ids saved by admin
    caseTypes: v.optional(v.array(
      v.object({ id: v.string(), name: v.string(), issues: v.array(v.string()) })
    )),
    defaultCurrency: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    emailFromName: v.optional(v.string()),
    emailFromAddress: v.optional(v.string()),
    documentTypes: v.optional(v.array(v.string())),
    appointmentTypes: v.optional(v.array(v.string())),
    // Custom roles: org-scoped role catalog. Each role maps to a permission tier.
    // Built-ins (id="case_manager"/"staff") are renameable but not deletable.
    customRoles: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      permissionLevel: v.union(v.literal("case_manager"), v.literal("staff"), v.literal("accountant")),
      isDefault: v.boolean(),
    }))),
    // Appointment booking toggle (per-org)
    bookingEnabled: v.optional(v.boolean()),
    // Stripe payment gateway (per-org)
    stripeEnabled: v.optional(v.boolean()),
    stripePublishableKey: v.optional(v.string()),
    // Legacy plaintext fields — kept for backward compat; prefer *Enc fields below.
    stripeSecretKey: v.optional(v.string()),
    stripeWebhookSecret: v.optional(v.string()),
    // AES-256-GCM encrypted fields: format "{iv_hex}:{ciphertext_hex}"
    // Encrypted with STRIPE_MASTER_KEY Convex env var. Preferred over plaintext.
    stripeSecretKeyEnc: v.optional(v.string()),
    stripeWebhookSecretEnc: v.optional(v.string()),
  }).index("by_org", ["organisationId"]),

  // ─── Stripe Disputes / Chargebacks ────────────────────────────────────────────
  disputes: defineTable({
    organisationId: v.id("organisations"),
    paymentId: v.optional(v.id("payments")),        // linked Convex payment record (if found)
    stripeDisputeId: v.string(),                     // e.g. dp_xxx
    stripePaymentIntentId: v.optional(v.string()),
    amount: v.number(),                              // in cents
    currency: v.string(),
    reason: v.string(),                              // Stripe dispute reason
    status: v.union(
      v.literal("warning_needs_response"),
      v.literal("warning_under_review"),
      v.literal("warning_closed"),
      v.literal("needs_response"),
      v.literal("under_review"),
      v.literal("charge_refunded"),
      v.literal("won"),
      v.literal("lost")
    ),
    dueBy: v.optional(v.number()),                  // epoch ms — when evidence is due
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["organisationId"])
    .index("by_stripe_dispute", ["stripeDisputeId"]),

  // ─── Stripe Webhook Audit Log ─────────────────────────────────────────────────
  webhookLogs: defineTable({
    organisationId: v.id("organisations"),
    stripeEventId: v.string(),                       // Stripe event ID (idempotency)
    eventType: v.string(),                           // e.g. "payment_intent.succeeded"
    status: v.union(
      v.literal("processed"),
      v.literal("skipped"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    processedAt: v.number(),
  })
    .index("by_org", ["organisationId"])
    .index("by_event_id", ["stripeEventId"]),
});
