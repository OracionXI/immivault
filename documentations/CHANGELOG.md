# ImmiVault Changelog

All notable changes to this project are documented in this file.
Versions follow the branch naming convention used in development (`feature/[frontend|backend]-v.X.Y.Z`).

---

## [v0.1.12] — 2026-03-23

**Branch:** `feature/frontend-v.0.1.12`

### Added
- **Stripe key encryption (AES-256-GCM):** Per-org Stripe secret key and webhook secret are now encrypted at rest using a platform `STRIPE_MASTER_KEY` env var. `convex/lib/crypto.ts` provides `encryptSecret` / `decryptSecret` using the Web Crypto API. Legacy plaintext fields preserved for backward compatibility.
- **Stripe settings action:** `convex/organisations/actions.ts` — new `saveStripeSettings` action validates key format, encrypts secrets, and calls an internal mutation. Replaces the old `updateStripeSettings` public mutation.
- **Refund payments:** Admins and accountants can initiate Stripe refunds from the Payments page. Refund button shown on Completed card payments; triggers Stripe Refunds API and marks payment as Refunded.
- **Dispute / chargeback tracking:** New `disputes` table. `charge.dispute.created/updated/closed` webhook events create/update dispute records. Notifications sent to all admin users. New Disputes tab on Payments page with status badges and due-by dates.
- **Webhook idempotency:** New `webhookLogs` table. Each Stripe event is checked against `stripeEventId` before processing to prevent duplicate handling.
- **Invoice PDF download:** FileDown button on Billing page fetches invoice line items imperatively and generates a PDF via jsPDF + jspdf-autotable (letter format, line items table, subtotal/tax/total, notes, signature row).
- **Tax metadata in PaymentIntent:** `taxRate` and `taxAmount` passed as metadata when creating Stripe PaymentIntents.
- **Currency validation:** `createPaymentIntent` validates the currency code against a whitelist of ~80 Stripe-supported currencies.
- **Dynamic webhook URL:** Payment settings page now reads `NEXT_PUBLIC_CONVEX_SITE_URL` instead of a hardcoded URL for the webhook endpoint.
- **`payment_dispute` notification type:** Added to schema, notification bell icon (red AlertTriangle), and click routing to `/payments`.
- **Appointment notification types:** Added `appointment_created`, `appointment_updated`, `appointment_cancelled` to notification bell icon map.

### Changed
- `updateStripeSettings` mutation replaced by `saveStripeSettings` action (settings page now uses `useAction`).
- `updateStripeSettingsInternal` is now an `internalMutation` only callable by the action.
- Webhook handler returns `400` for signature failures (no Stripe retry) and `500` for processing errors (Stripe will retry).
- Payment settings "masked key" sentinel now passes `""` (keep existing) instead of the masked placeholder string.

### Fixed
- **Duplicate invoice on payment link pay:** `recordPaidInvoiceAndUpdateDraft` was creating a new "Paid" invoice even when the payment link already had a linked `invoiceId`. Fixed: receipt invoice only created when no `invoiceId` is present.
- **N+1 contract draft query:** Changed from `by_org` index + `.filter()` to `by_client` index for efficient single-client lookup.

### Removed
- **Email Sender Identity card** from Settings page (From Name / From Email Address fields). Deferred to Phase 4 (Resend integration). Design spec saved in memory.
- **Email template fields** (`emailFromName`, `emailFromAddress`) removed from `updateSettings` mutation args. Schema fields retained as optional for future use.

---

## [v0.1.11] — 2026-03-10

**Branch:** `feature/frontend-v.0.1.11`

### Added
- **Tasks page — case filter from URL:** Navigating to `/tasks?case=<id>` pre-filters the task list to that case. A dismissible badge shows the active case filter and can be cleared inline.
- **Documents page — case filter from URL:** Navigating to `/documents?case=<id>` pre-filters documents to that case, with the same dismissible badge UI.
- **Documents page — file size column:** New "Size" column in the documents table displays human-readable file sizes (B / KB / MB).
- **Case Detail Dialog — "See all" shortcuts:** Tasks and Documents sections inside the Case Detail Dialog now have a "See all →" button that closes the dialog and redirects to `/tasks?case=<id>` or `/documents?case=<id>` respectively.
- **MentionTextarea in task modals:** Task description field now uses `MentionTextarea` — supports `@mention` for team members and case documents.
- **MentionTextarea in case modals:** Case notes field now uses `MentionTextarea` with the same `@mention` support.
- **MentionBody in detail dialogs:** Case notes and task descriptions in their detail dialogs now render `@mention` tokens as styled chips (name, document link) instead of raw text.
- **Staff modal improvements:** Expanded staff edit/invite modal with additional fields and UI polish.
- **DataTable enhancements:** Improved column rendering flexibility.
- **Convex user mutations:** Additional user-level mutation support.

### Changed
- Case kanban cards no longer show Tasks/Docs redirect buttons — these were moved into the Case Detail Dialog as "See all →" links.
- Notification popover now uses a native scrollable `div` instead of Radix `ScrollArea`, ensuring the list never overflows below the screen edge.

### Fixed
- Notification list overflow — the popover was expanding past the viewport bottom with no scroll. Now capped at `min(24rem, 100dvh − 10rem)` with `overflow-y-auto`.
- Verify page null guard for incomplete sign-up states.

---

## [v0.1.10] — 2026-03-10

**Branch:** `feature/frontend-v.0.1.10` | PRs #13, #14 (hotfixes)

### Fixed
- Auth bug fixes v5 & v6: resolved edge cases in login and signup flows introduced in v0.1.9.
- Signup page: added missing `username` field and corrected field validation.
- Verify page: improved null-safety when `signUp` object is undefined; handle non-`"complete"` statuses gracefully.
- Middleware: tightened public route matchers to prevent redirect loops.

---

## [v0.1.9] — 2026-03-10

**Branch:** `feature/frontend-v.0.1.9` | PR #12

### Changed
- Auth pages (`login`, `signup`, `verify`, `forgot-password`, `invite`) fully migrated to `@clerk/nextjs/legacy` hooks (`useSignIn`, `useSignUp`) for fine-grained control over the auth flow.
- Auth layout updated to accommodate new page structures.
- Reset password page (`/auth/reset-password`) refactored.

### Fixed
- Auth bug fixes v3: multiple edge cases across `forgot-password`, `invite`, `signup`, and `verify` pages corrected after Clerk legacy hook migration.

---

## [v0.1.8] — 2026-03-09

**Branch:** `feature/frontend-v.0.1.8` | PR #11

### Added
- Auth routing: login and signup pages moved to `[[...rest]]` catch-all segments to support Clerk's hash-based routing (`routing="hash"`).

### Fixed
- Device login issue: Clerk `useSignIn`/`useSignUp` hooks now correctly handle multi-device sessions.
- Settings page: expanded profile/account settings with additional editable fields via new Convex user mutations.
- Renamed `proxy.ts` → `middleware.ts` to resolve Next.js build conflict (Next.js requires the middleware file to be named `middleware.ts`).

---

## [v0.1.7] — 2026-03-09

**Branch:** `feature/backend-v.0.1.7` | PR #10

### Added
- Organization-level data isolation: all Convex queries now enforce `orgId` scoping so users from different organisations never see each other's data.
- `cases/queries.ts`: added org-scoped indexes and query filters.
- `clients/mutations.ts`: org ownership enforced on create/update.

### Fixed
- Provider bug fix: resolved a React context provider ordering issue that caused query failures on first load.
- `organisations/mutations.ts`: corrected mutation logic for org settings updates.

---

## [v0.1.6] — 2026-03-08

**Branch:** `feature/backend-v.0.1.6` | PR #9

### Fixed
- Convex schema corrections to resolve Vercel build failures (`convex/schema.ts`).
- `LOGIC_DOCUMENTATION.md` updated to reflect schema changes.

---

## [v0.1.5] — 2026-03-08

**Branch:** `feature/frontend-v.0.1.5` | PR #8

### Added
- **Case Settings — Case Types:** New settings page (`/settings/case-types`) to configure visa/immigration case types and their associated issue sub-types.
- **Case Settings — Case Stages:** Enhanced case stages settings page (`/settings/case-stages`) with custom stage management.
- **Document mutations:** Full CRUD for documents added to Convex backend (`convex/documents/mutations.ts`, `convex/documents/queries.ts`).
- **Document edit modal:** New `edit-document-modal.tsx` for renaming and updating document metadata.
- **Case modal — type & issue selectors:** Case create/edit form now includes visa type and issue dropdowns, populated from org settings.
- **KanbanBoard — column reorder:** Admins can drag-and-drop columns to reorder them; new `onColumnReorder` prop wired to settings.
- **Documentation suite:** Added `IMPLEMENTATION_PLAN.md`, `LOGIC_DOCUMENTATION.md`, `RBAC_OVERVIEW.md`, `SESSION_SUMMARY_RBAC.md`, and a Convex architecture guidelines doc under `documentations/`.
- **Status badge:** Expanded to support all priority and stage values.

### Fixed
- Task mutation edge cases resolved.
- Client mutations hardened.
- Organisation settings mutation corrected.

---

## [v0.1.4] — 2026-03-08

**Branch:** `feature/frontend-v.0.1.4` | PR #7

### Added
- `organisations/mutations.ts`: `reactivateOrg` mutation for soft-deleted org recovery.
- `organisations/queries.ts`: org settings and member queries.
- `users/queries.ts`: additional user lookup queries for role filtering.

### Fixed
- **Case manager cascade unassign:** Unassigning or replacing a case's case manager now automatically clears `assignedTo` on all tasks in that case belonging to the old manager.
- **Comment permissions:** Admins can delete any comment; case managers and staff can only edit/delete their own. Enforced in both frontend UI and backend (`comments/mutations.ts`).
- Case detail dialog: role-based edit/delete button visibility corrected.
- Task detail dialog: same role-based visibility fixes applied.
- Case modal: case manager filter (only active `case_manager` role users shown in assignee dropdown).
- Forgot password page: minor flow corrections.
- Schema: added missing indexes for org queries.

---

## [v0.1.3] — 2026-03-08

**Branch:** `feature/frontend-v.0.1.3` | PR #6

### Added
- **Notification system (full implementation):**
  - Bell icon in header with unread count badge.
  - Popover listing recent notifications with icons, relative timestamps, and unread dot indicators.
  - "Mark all read" action.
  - Click-to-navigate: case notifications → `/cases?open=<id>`, task notifications → `/tasks?open=<id>`, document notifications → `/documents?doc=<id>`.
  - 10 trigger types: `case_created`, `case_assigned`, `case_status_changed`, `case_deadline`, `task_assigned`, `task_status_changed`, `task_overdue`, `comment`, `mention`, `document_uploaded`.
  - Email notifications via Resend (silently skipped if `RESEND_API_KEY` is not set).
  - Deadline reminder cron job via `convex/notifications/jobs.ts`.
- **`@mention` tagging in comments:** `MentionTextarea` component (`src/components/shared/mention-textarea.tsx`) supports `@name` autocomplete for users and documents. Tokens stored as `@[Name](user:id)` / `@[Name](doc:id)`. `MentionBody` renders them as styled chips.
- **Deep-link auto-open:** Cases, Tasks, and Documents pages read `?open=<id>` / `?doc=<id>` from the URL on load, auto-open the relevant detail dialog, then clean the URL param.
- Convex schema additions: `notifications` table, `mentions` tracking.
- Crons registered in `convex/crons.ts`.

### Fixed
- Build errors resolved that blocked Vercel deployment.

---

## [v0.1.2] — 2026-03-04

**Branch:** `feature/backend-v.0.1.2` | PR #5

### Added
- **Comment system:** Users can add, edit, and delete comments on cases and tasks from their detail dialogs.
- **`MentionTextarea` (initial version):** Autocomplete textarea component for `@mention` support in comments.
- **Onboarding flow:** Full onboarding page (`/onboarding`) for new org setup — org name, plan selection, and initial configuration.
- **Waiting page:** `/waiting` screen shown to users pending admin activation.
- **Welcome page:** `/welcome` screen for newly verified users before org join.
- **Org soft-delete infrastructure:** `organisations` table gets `deletedAt` field; `purgeExpiredOrgs` daily cron deletes Clerk users and Convex records after grace period.
- **License revoked gate:** `LicenseRevoked` component blocks access when org subscription is inactive.
- **Org deleted gate:** `OrgDeletedGate` component handles soft-deleted org state.
- **Invite flow:** `/invite` page for staff invitation acceptance with Clerk token handling.
- `organisations/jobs.ts`: daily purge cron for expired orgs.

### Fixed
- Webhook handler (`convex/http.ts`) corrected for Clerk user sync.
- Auth library (`convex/lib/auth.ts`) hardened.
- Various user mutation edge cases resolved.

---

## [v0.1.1] — 2026-03-03

**Branch:** `feature/backend-v.0.1.1` | PR #4

### Added
- **Role guard component** (`src/components/shared/role-guard.tsx`): wraps UI sections to conditionally render based on the current user's role (`admin`, `case_manager`, `staff`).
- **`useRole` hook** (`src/hooks/use-role.ts`): convenience hook returning the current user's role from Convex.
- **Sonner toast notifications** (`src/components/ui/sonner.tsx`): toast integration for success/error feedback.
- Role guards applied to: Billing, Clients, Staff, Reports, Payments, and Settings pages.
- Admin-only access enforced on sensitive settings sections.

### Fixed
- Case mutations: permission checks for create/update tightened.
- Task mutations: assignee validation enforced server-side.
- Documents page: role-based action button visibility.
- Tasks page: role-based kanban drag permissions.

---

## [v0.1.0] — 2026-03-03

**Branch:** `feature/backend-v.0.1.0` | PR #3

### Added
- **Full RBAC system:**
  - `convex/lib/rbac.ts`: role permission matrix for all entities.
  - `convex/lib/visibility.ts`: field-level visibility rules.
  - `authenticatedMutation` / `authenticatedQuery` wrappers enforce auth on every Convex call.
- **Cases feature (full):** Create, read, update, delete cases with status, priority, visa type, assignee, and client linkage. Kanban view with drag-and-drop.
- **Tasks feature (full):** Create, read, update, delete tasks linked to cases. Kanban view with priority-colored cards and due date indicators.
- **Staff invite modal:** Admins can invite staff by email (`/staff/invite-modal.tsx`); invitation handled via Clerk + Convex webhook.
- **Document viewer:** In-app PDF/image viewer component (`src/components/shared/document-viewer.tsx`).
- **Error boundary:** Global React error boundary (`src/components/shared/error-boundary.tsx`).
- **Public payment page** (`/pay/[token]`): Clients can pay invoices via a tokenised public link.
- **Rate limiter** (`convex/lib/rateLimit.ts`): per-user rate limiting on sensitive mutations.
- **Archival system** (`convex/archival/`): scheduled archival of old closed cases.
- **Billing, bank accounts, email templates, automation rules** — full Convex backend implementations.
- **Comprehensive test suite** (`src/__tests__/`): billing calculations, case identifiers, email formatting, performance, rate limiter — using Vitest.
- **Docker support:** `Dockerfile` and `.dockerignore` added.
- Removed mock data (`src/lib/mock-data.ts`) — all pages now use live Convex queries.

### Changed
- All pages (Cases, Tasks, Clients, Documents, Staff, Dashboard, Reports, Payments, Settings) wired to real Convex backend.
- Header and Sidebar updated with role-aware navigation.
- KanbanBoard: drag-and-drop now calls Convex mutations on drop; disabled statuses and per-role drag restrictions added.

---

## [Backend Alpha] — 2026-03-01

**Branch:** `feature/backend-v.alpha` | PR #2

### Added
- **Full Convex backend scaffolded** (Phase 0 + Phase 1 + Phase 2 complete):
  - Schema: all tables defined (`users`, `organisations`, `clients`, `cases`, `tasks`, `documents`, `comments`, `notifications`, `appointments`, `billing`, `payments`, `bankAccounts`, `emailTemplates`, `automationRules`, `archival`).
  - Domain-driven folder structure: each entity has its own `convex/<entity>/` folder with `mutations.ts` and `queries.ts`.
  - `convex/lib/auth.ts`: `authenticatedQuery` / `authenticatedMutation` wrappers.
  - `convex/http.ts`: Clerk webhook handler for user provisioning.
  - `convex/auth.config.ts`: Clerk JWT issuer configuration.
  - `convex/dashboard/queries.ts`: aggregated stats for the dashboard.
  - `convex/seed.ts`: seed data for development.
- **Clerk authentication integrated:** Login, Signup, Verify, Forgot Password pages wired to Clerk.
- **`ConvexClientProvider` + `ClerkProvider`** configured in `src/components/providers.tsx`.
- **`InitGate` component:** Checks user/org provisioning status on every authenticated load; routes to onboarding, waiting, or app.
- **Dashboard charts** (`src/components/dashboard/dashboard-chart.tsx`): Recharts-based stats visualisations.
- **Verify email page** (`/verify`) and **Reset password page** (`/auth/reset-password`).
- **SSO callback page** (`/auth/sso-callback`).
- **Onboarding page** (`/onboarding`): basic org setup flow.
- All app pages connected to Convex queries replacing mock data.
- Next.js tsconfig updated; Convex `_generated/` types imported for end-to-end type safety.

---

## [Frontend Alpha] — 2026-02-28

**Branch:** `feature/frontend-v.alpha` | PR #1

### Added
- **Project initialised:** Next.js 15 (App Router) + Tailwind CSS + shadcn/ui component library.
- **Full UI scaffold** for all major pages (mock-data driven):
  - Dashboard with KPI cards and chart placeholders.
  - Cases — Kanban board + DataTable, case modal, case detail dialog.
  - Tasks — Kanban board + DataTable, task modal, task detail dialog.
  - Clients — DataTable, client modal.
  - Documents — DataTable, upload modal.
  - Staff — DataTable, staff modal.
  - Appointments — DataTable, appointment modal.
  - Billing — DataTable, invoice modal.
  - Payments — DataTable + settings.
  - Reports — placeholder page.
  - Settings — layout with sidebar nav, sub-pages (case-stages, booking, automations, bank-accounts, email-templates).
- **Auth pages:** Login, Signup, Forgot Password (UI only, no Clerk integration yet).
- **Shared components:** `DataTable`, `KanbanBoard`, `StatusBadge`, `PageHeader`, `ConfirmDialog`.
- **Layout:** `Sidebar`, `Header`, `AppLayout`.
- **shadcn/ui components added:** Button, Input, Select, Dialog, Popover, Command, Badge, Card, Table, Tabs, Switch, Tooltip, Avatar, Calendar, ScrollArea, Sheet, Separator, DropdownMenu, AlertDialog, Checkbox, Label, Textarea.
- **PDF generator utility** (`src/lib/pdf-generator.ts`).
- **Type definitions** (`src/lib/types.ts`): shared TypeScript interfaces for the entire app.
- `PROJECT_PLAN.md` added with initial feature roadmap.

---

## [v0.0.0] — Initial Commit

- Repository created.
- `README.md` with project overview: ImmiVault — immigration case management SaaS platform.
