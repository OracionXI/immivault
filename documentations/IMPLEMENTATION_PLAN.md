# ImmiVault — Implementation Plan (Convex + Clerk)

> Based on `convex_enterprise_architecture_guidelines.md`, `.claude/rules/`, and `immivault-frontend/PROJECT_PLAN.md`

---

## Progress

```
Phase 0 ✅ → Phase 1 ✅ → Phase 2 ✅ → Phase 3 ✅ → Phase 4 ⬜ NEXT → Phase 5 ⬜
Bootstrap      Auth           Data Layer     Core Feats      Notifs         Hardening
```

---

## Current State (as of 2026-03-01)

| Area | Status |
|---|---|
| UI / Pages | Complete — 21 routes, all wired to Convex |
| Authentication | ✅ Real Clerk auth — sign in, sign up, org creation, session guard, sign out |
| Database | ✅ Convex initialized — schema complete, all 13 tables live |
| File Storage | ✅ Convex Storage — upload modal live, download via signed URLs |
| API / Mutations | ✅ All domains have queries + mutations (clients, cases, tasks, appointments, billing, staff, documents, organisations) |
| Realtime | ✅ Automatic via `useQuery` reactive subscriptions |
| Dashboard Chart | ✅ Recharts ComposedChart with configurable axes + time range |
| Emails / Notifications | ⬜ Phase 4 — Resend not yet integrated |
| Automation Rules | ⬜ Phase 4 — local state only, no Convex persistence |
| Email Templates | ⬜ Phase 4 — local state only, no Convex persistence |
| Bank Accounts | ⬜ Phase 4 — local state only, no Convex persistence |
| Payment Gateways | ⬜ Phase 4 — UI shell only (Stripe/PayPal keys not wired) |
| Mock Data | ✅ Deleted — `src/lib/mock-data.ts` removed |

---

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js App Router + shadcn/ui | Complete |
| Auth | Clerk | Real auth active — orgs, JWT template `convex`, webhook syncing users |
| Backend | Convex | Live — all domain files written, reactive queries |
| File Storage | Convex Storage | Phase 3 |
| Emails | Resend | Phase 4 — called from Convex Actions |
| Realtime | Automatic | `useQuery` is reactive — no extra setup needed |

---

## Actual File Structure (current)

```
convex/
├── _generated/                  # Auto-generated — never touch
├── schema.ts                    # All 13 table definitions + indexes ✅
├── auth.config.ts               # Clerk JWT validation ✅
├── env.ts                       # requireEnv() utility ✅
├── http.ts                      # Clerk webhook handler ✅
├── lib/
│   ├── auth.ts                  # authenticatedQuery / authenticatedMutation ✅
│   └── utils.ts                 # Shared helpers ✅
├── users/
│   ├── mutations.ts             # ✅
│   └── queries.ts               # ✅
├── organisations/
│   ├── mutations.ts             # ✅ includes updateSettings
│   └── queries.ts               # ✅ includes mine, getSettings
├── clients/
│   ├── mutations.ts             # ✅
│   └── queries.ts               # ✅ listAll + list + get
├── cases/
│   ├── mutations.ts             # ✅ includes updateStatus (kanban)
│   └── queries.ts               # ✅ listAll + list + get + listByClient
├── tasks/
│   ├── mutations.ts             # ✅ includes updateStatus (kanban)
│   └── queries.ts               # ✅
├── documents/
│   ├── mutations.ts             # ✅ stub (generateUploadUrl = Phase 3)
│   └── queries.ts               # ✅
├── appointments/
│   ├── mutations.ts             # ✅
│   └── queries.ts               # ✅
├── billing/
│   ├── mutations.ts             # ✅ invoices, items, payments, paymentLinks
│   └── queries.ts               # ✅
├── comments/
│   ├── mutations.ts             # ✅
│   └── queries.ts               # ✅
└── dashboard/
    └── queries.ts               # ✅ stats + chartData (monthly aggregates)

src/
├── app/
│   ├── (auth)/                  # ✅ login, signup, verify, forgot-password
│   └── (app)/
│       ├── dashboard/           # ✅ real stats + DashboardChart (recharts)
│       ├── clients/             # ✅ Convex list + CRUD modal
│       ├── cases/               # ✅ Convex list + kanban + CRUD modal
│       ├── tasks/               # ✅ Convex list + kanban + CRUD modal
│       ├── appointments/        # ✅ Convex list + CRUD modal
│       ├── billing/             # ✅ invoices + payments + paymentLinks
│       ├── payments/            # ✅ Convex payments + payment links
│       ├── documents/           # ✅ Convex list (upload = Phase 3)
│       ├── staff/               # ✅ Convex users.listByOrg
│       ├── reports/             # ✅ Convex data + real PDF export
│       └── settings/
│           ├── page.tsx         # ✅ org info + updateSettings (currency, tax, email)
│           ├── booking/         # ✅ bookingEnabled + bookingUrl (Phase 3: slot config)
│           ├── case-stages/     # ✅ caseStages string array via updateSettings
│           ├── automations/     # ⬜ Phase 4 — local state only
│           ├── email-templates/ # ⬜ Phase 4 — local state only
│           └── bank-accounts/   # ⬜ Phase 4 — local state only
├── components/
│   ├── dashboard/
│   │   └── dashboard-chart.tsx  # ✅ ComposedChart with metric/range selectors
│   ├── layout/                  # ✅ header (real sign-out), sidebar
│   ├── shared/                  # ✅ page-header, status-badge, confirm-dialog, init-gate
│   └── providers.tsx            # ✅ ClerkProvider + ConvexProviderWithClerk
├── proxy.ts                     # ✅ clerkMiddleware route guards (was middleware.ts)
└── lib/
    └── pdf-generator.ts         # ✅ uses Convex types (ReportClient, ReportCase, etc.)
```

---

## Phase 0 — Bootstrap ✅ COMPLETE

**Goal:** Install all packages, initialize Convex, create Clerk app, wire providers.

### What was done
- Installed: `convex`, `@clerk/nextjs`, `@clerk/clerk-react`, `convex-helpers`, `recharts`
- Initialized Convex — `convex/` dir and `NEXT_PUBLIC_CONVEX_URL` set in `.env.local`
- Created Clerk application — Google + GitHub OAuth, Organizations enabled
- Added JWT template named `convex` in Clerk dashboard
- Created `convex/auth.config.ts`
- Wired `ClerkProvider → ConvexProviderWithClerk → ThemeProvider` in `providers.tsx`

---

## Phase 1 — Authentication ✅ COMPLETE

**Goal:** Full auth flow — login, signup, org creation, session guard, sign out, staff invite.

### What was done
- **`src/proxy.ts`** (not `middleware.ts`) — `clerkMiddleware` guards all `/(app)/*` routes
  - Public routes: `/login`, `/signup`, `/verify`, `/forgot-password`, `/pay/[token]`
- **Login page** — wired to Clerk `useSignIn()` with Google OAuth
- **Signup page** — wired to Clerk `useSignUp()`, creates org on first sign-up
- **Verify page** — `signUp.attemptEmailAddressVerification({ code })`
- **Forgot password** — Clerk reset flow
- **`convex/lib/auth.ts`** — `authenticatedQuery` + `authenticatedMutation` wrappers
- **`convex/schema.ts`** — `users` + `organisations` + `organisationSettings` tables
- **`convex/http.ts`** — Clerk webhook handler (Svix signature verification, user sync)
- **`convex/users/mutations.ts`** — `syncUser` internalMutation (webhook target)
- **Header** — real `useClerk().signOut()`, real `useUser()` name + avatar
- **`InitGate` component** — waits for user sync before rendering app (prevents USER_NOT_FOUND race)

---

## Phase 2 — Schema + Backend Foundation ✅ COMPLETE

**Goal:** Define all tables and indexes. Write domain queries + mutations. Replace all mock data.

### What was done

**Backend (convex/):**
- All 13 tables defined in `schema.ts` with mandatory compound indexes (no `.filter()` on large tables)
- `convex/clients/` — `list`, `listAll`, `get`, `create`, `update`, `remove`
- `convex/cases/` — `list`, `listAll`, `get`, `listByClient`, `create`, `update`, `remove`, `updateStatus`
- `convex/tasks/` — `list`, `listByCase`, `create`, `update`, `remove`, `updateStatus`
- `convex/documents/` — `list`, `listByClient`, `create` stub, `remove`, `updateStatus`
- `convex/appointments/` — `list`, `listUpcoming`, `create`, `update`, `remove`, `updateStatus`
- `convex/billing/` — `listInvoices`, `getInvoice`, `listPayments`, `listPaymentLinks`, `createInvoice`, `updateInvoice`, `removeInvoice`, `addInvoiceItem`, `removeInvoiceItem`, `recordPayment`, `createPaymentLink`
- `convex/comments/` — `listByEntity`, `create`, `remove`
- `convex/organisations/` — `mine`, `getSettings`, `updateSettings`
- `convex/dashboard/` — `stats` (counts + recent items) + `chartData` (monthly aggregates)

**Frontend — connected to Convex:**
- `dashboard/page.tsx` — real stats + `DashboardChart` (recharts ComposedChart)
- `clients/page.tsx` + `client-modal.tsx` — firstName/lastName fields, real CRUD
- `cases/page.tsx` + `case-modal.tsx` — clientId picker, kanban drag → `updateStatus`
- `tasks/page.tsx` + `task-modal.tsx` — caseId + assignedTo pickers, kanban drag
- `appointments/page.tsx` + `appointment-modal.tsx` — clientId + assignedTo pickers
- `billing/page.tsx` + `invoice-modal.tsx` — real invoices, items, send/pay actions
- `payments/page.tsx` — real payments list + payment links with create flow
- `staff/page.tsx` — `users.listByOrg`, role/status edit
- `documents/page.tsx` — real list (empty until Phase 3 upload)
- `documents/upload-modal.tsx` — real clients query for picker (upload = Phase 3)
- `reports/page.tsx` — real data + PDF generation using Convex types
- `settings/page.tsx` — org info display + updateSettings (currency, taxRate, email)
- `settings/booking/page.tsx` — bookingEnabled + bookingUrl (slot config = Phase 3)
- `settings/case-stages/page.tsx` — `caseStages` string array via updateSettings
- `settings/automations/page.tsx` — local state, Phase 4 note
- `settings/email-templates/page.tsx` — local state, Phase 4 note
- `settings/bank-accounts/page.tsx` — local state, Phase 4 note
- `payments/settings/page.tsx` — UI shell (Stripe/PayPal keys = Phase 4)

**Deleted:**
- `src/lib/mock-data.ts` — confirmed zero imports before deletion

---

## Phase 3 — Core Features ✅ COMPLETE

**Goal:** File uploads (Convex Storage), public payment page, booking slot config.

### 3.1 Document File Storage

**Pattern** (two-step Convex Storage upload):
1. Client calls `useMutation(api.documents.mutations.generateUploadUrl)` → one-time upload URL
2. Client `PUT`s file directly to Convex Storage (no Next.js proxy)
3. On success, client calls `useMutation(api.documents.mutations.create)` with `storageId`
4. Download: `ctx.storage.getUrl(storageId)` returns expiring signed URL

**Files to change:**
- `convex/documents/mutations.ts` — implement real `generateUploadUrl` + `create` with storageId
- `convex/documents/queries.ts` — add `getDownloadUrl` (returns signed URL per document)
- `src/app/(app)/documents/upload-modal.tsx` — full rewrite with real upload flow
- `src/app/(app)/documents/page.tsx` — add download button using signed URL

**Schema addition** (already in schema, needs `bookingUrl` too):
```ts
organisationSettings: {
  // existing fields...
  bookingUrl: v.optional(v.string()),   // ← add this
  // Phase 3: slot config fields
  slotDuration: v.optional(v.number()),
  bufferTime: v.optional(v.number()),
  availableStartTime: v.optional(v.string()),
  availableEndTime: v.optional(v.string()),
  availableDays: v.optional(v.array(v.string())),
}
```

### 3.2 Public Payment Page

- `src/app/pay/[token]/page.tsx` — no auth required
- Queries `api.billing.queries.getPaymentLinkByToken` (public query, no auth wrapper)
- Shows invoice summary + amount
- On "Pay" → calls `api.billing.mutations.recordPayment` (marks invoice Paid, link Used)

### 3.3 Booking Slot Configuration

- Extend `convex/schema.ts` `organisationSettings` with slot config fields (above)
- Update `convex/organisations/mutations.ts` `updateSettings` to accept new fields
- `settings/booking/page.tsx` — add slotDuration, bufferTime, availableDays, start/endTime

### 3.4 Realtime (Already Active)

`useQuery` in Convex is reactive by default — no extra setup required.
- Kanban updates propagate instantly to all connected tabs
- `updateStatus` mutation already implemented for cases and tasks

### Phase 3 Checklist

- [ ] Implement `generateUploadUrl` in `convex/documents/mutations.ts`
- [ ] Implement `create` (with real storageId) in `convex/documents/mutations.ts`
- [ ] Add `getDownloadUrl` to `convex/documents/queries.ts`
- [ ] Rewrite `documents/upload-modal.tsx` with real Convex Storage flow
- [ ] Add download functionality to `documents/page.tsx`
- [ ] Add `bookingUrl` + slot config fields to `convex/schema.ts`
- [ ] Update `updateSettings` mutation for new booking fields
- [ ] Expand `settings/booking/page.tsx` with slot configuration UI
- [ ] Create `src/app/pay/[token]/page.tsx` public payment page
- [ ] Add `getPaymentLinkByToken` public query to `convex/billing/queries.ts`

---

## Phase 4 — Notifications & Automation ⬜ NEXT

**Goal:** Email notifications, scheduled jobs, staff invite, and persistence for automation/email-templates/bank-accounts.

### 4.1 New Convex Tables Needed

```ts
// Add to convex/schema.ts:

automationRules: defineTable({
  organisationId: v.id("organisations"),
  name: v.string(),
  trigger: v.string(),
  condition: v.string(),
  action: v.string(),
  status: v.union(v.literal("active"), v.literal("inactive")),
}).index("by_org", ["organisationId"]),

emailTemplates: defineTable({
  organisationId: v.id("organisations"),
  name: v.string(),
  subject: v.string(),
  body: v.string(),
  category: v.string(),
}).index("by_org", ["organisationId"]),

bankAccounts: defineTable({
  organisationId: v.id("organisations"),
  bankName: v.string(),
  accountName: v.string(),
  accountNumber: v.string(),
  routingNumber: v.string(),
  isDefault: v.boolean(),
}).index("by_org", ["organisationId"]),
```

### 4.2 Install Resend

```bash
npm install resend
```

Add `RESEND_API_KEY` to `.env.local` and Convex environment variables.

### 4.3 Email Actions — `convex/notifications/actions.ts`

All email sending uses `internalAction` — called via `ctx.scheduler.runAfter(0, ...)` to keep mutations fast:

Email triggers:
- New case assigned → attorney notified
- Invoice sent → client gets payment link email
- Appointment confirmed/cancelled → client + staff notified
- Document expiry in 30 days → warning email

### 4.4 Scheduled Jobs — `convex/crons.ts`

```ts
crons.daily("task due reminders", { hourUTC: 7, minuteUTC: 0 }, internal.notifications.jobs.sendTaskReminders);
crons.daily("document expiry warnings", { hourUTC: 8, minuteUTC: 0 }, internal.notifications.jobs.sendDocumentExpiryWarnings);
crons.daily("mark overdue invoices", { hourUTC: 0, minuteUTC: 0 }, internal.billing.jobs.markOverdueInvoices);
```

### 4.5 Staff Invite Flow

- Admin action calls Clerk `organizations.createOrganizationInvitation()` via `internalAction`
- Uses `CLERK_SECRET_KEY` (never exposed to client)
- Invited user signs up → webhook fires → user row created with correct `organisationId` + `role`

### 4.6 Connect Phase-4 UI Pages

- `settings/automations/page.tsx` → `convex/automationRules/` queries + mutations
- `settings/email-templates/page.tsx` → `convex/emailTemplates/` queries + mutations
- `settings/bank-accounts/page.tsx` → `convex/bankAccounts/` queries + mutations
- `payments/settings/page.tsx` → persist Stripe/PayPal keys encrypted in org settings

### Phase 4 Checklist

- [ ] Add `automationRules`, `emailTemplates`, `bankAccounts` tables to `convex/schema.ts`
- [ ] Create `convex/automationRules/`, `convex/emailTemplates/`, `convex/bankAccounts/` domain folders
- [ ] Connect `settings/automations/page.tsx` to Convex
- [ ] Connect `settings/email-templates/page.tsx` to Convex
- [ ] Connect `settings/bank-accounts/page.tsx` to Convex
- [ ] Add `RESEND_API_KEY` to Convex environment variables
- [ ] Create `convex/notifications/actions.ts` — email internalActions
- [ ] Create React email templates in `src/emails/`
- [ ] Create `convex/crons.ts` with all scheduled jobs
- [ ] Create `convex/notifications/jobs.ts` — cron targets
- [ ] Create `convex/billing/jobs.ts` — overdue invoice internalMutation
- [ ] Staff invite action using Clerk organizations API

---

## Phase 5 — Production Hardening ⬜

**Goal:** Security audit, rate limiting, error monitoring, CI/CD.

### 5.1 Rate Limiting — `convex/lib/rateLimit.ts`

```ts
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  sendInvite:        { kind: "fixed window",  rate: 5,  period: MINUTE },
  createPaymentLink: { kind: "token bucket",  rate: 10, period: HOUR   },
  sendEmail:         { kind: "fixed window",  rate: 20, period: MINUTE },
});
```

### 5.2 Internal Functions Audit

Any mutation/action triggered only by a cron or webhook must be `internalMutation` / `internalAction`. Audit all `convex/*/jobs.ts` and `convex/http.ts` handlers.

### 5.3 Environment Variable Validation

`convex/env.ts` `requireEnv()` called at top of every Action using external APIs (Resend, Clerk secret key).

### 5.4 Error Monitoring

```bash
npm install @sentry/nextjs
```

Wrap client-side error boundaries with Sentry. Convex dashboard provides server-side function logs.

### 5.5 CI/CD Pipeline

`.github/workflows/deploy.yml`:
```yaml
on:
  push:
    branches: [main]
jobs:
  validate:
    steps:
      - run: npx tsc --noEmit
      - run: npx eslint
  deploy:
    needs: validate
    steps:
      - run: npx convex deploy --cmd 'npm run build'
```

### Phase 5 Checklist

- [ ] Rate limiters applied to high-risk mutations (invite, paymentLink, email)
- [ ] All cron/webhook targets confirmed as `internal`
- [ ] `requireEnv()` called in every Action using external APIs
- [ ] Sentry installed and configured
- [ ] GitHub Actions CI/CD pipeline
- [ ] Staging environment (separate Convex deployment + Clerk app)

---

## Architecture Rules (from `.claude/rules/`)

### Convex Patterns (non-negotiable)
- All mutations use `authenticatedMutation` wrapper — never raw `mutation`
- All queries use `.withIndex()` — never `.filter()` on large tables
- Use `ConvexError` for all business logic violations (not raw `Error`)
- `internalMutation` / `internalAction` for webhook/cron targets only
- Domain-driven: each entity has its own folder under `convex/`
- Long-running logic → Action, not Mutation

### PR Checklist (from `.claude/rules/backend-architect.md`)

Before merging any PR:

- [ ] Does this mutation check `ctx.user` (via auth wrapper) before doing any work?
- [ ] Is every query using `.withIndex()` — no full table scans?
- [ ] Has long-running logic been moved to an Action, not a Mutation?
- [ ] Are sensitive fields stripped before returning data to the client?
- [ ] Are all errors thrown as `ConvexError` (not raw `Error`)?
- [ ] Is logic correctly domain-segregated into the right folder?
- [ ] Are automated-only functions marked `internal`?
- [ ] No dead code — mock data, unused imports, TODO stubs? (`.claude/rules/coding-standards.md`)
- [ ] No secrets in source code — all API keys in env vars? (`.claude/rules/security-rules.md`)

---

## Execution Timeline

```
Phase 0 ✅     Phase 1 ✅     Phase 2 ✅     Phase 3 ✅     Phase 4 ⬜     Phase 5 ⬜
Bootstrap      Auth           Data Layer     Core Feats      Notifs         Hardening
DONE           DONE           DONE           DONE            NEXT           After 4
```
