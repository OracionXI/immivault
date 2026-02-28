# ImmiVault — Full Project Plan

## Backend & Database Recommendation

### Your choice: Convex

Convex is a reactive, serverless backend with real-time queries and TypeScript-first functions. It works well for collaborative apps and integrates directly with Next.js.

**Pros for ImmiVault**
- Zero-config real-time: case/task updates push live to all open tabs
- TypeScript end-to-end — schema, queries, and mutations are fully typed
- Built-in file storage for documents
- No server to manage; Convex Cloud handles scaling

**Cons / watch-outs**
- Document-based model — relational joins are manual (no foreign-key enforcement)
- Weaker support for complex aggregate queries (e.g. billing summaries, audit trails)
- Vendor lock-in with a relatively young platform

---

### Recommended alternative: Supabase ✦

> For ImmiVault specifically, Supabase is the stronger fit. Here is why:

ImmiVault's data is **deeply relational**: an Organisation has Staff, Staff manage Clients, Clients have Cases, Cases have Tasks, Documents, Appointments, and Invoices that produce Payments. PostgreSQL enforces this structure at the database level — Convex's document store does not.

| Need | Supabase | Convex |
|---|---|---|
| Relational integrity | Native (FK + constraints) | Manual |
| Document file storage | Built-in (S3-backed) | Built-in |
| Auth (email, Google, GitHub) | Built-in | Needs Clerk or Auth0 |
| Row-level security (multi-tenant) | Native RLS policies | Manual middleware |
| Complex aggregations / reports | Full SQL | Limited |
| Realtime updates | Postgres replication channels | Reactive queries (better UX) |
| Self-hosting / data sovereignty | Yes (legal compliance) | No |
| Open source | Yes | No |

**Verdict**: Use Supabase for structured integrity + file storage + auth. Add Supabase Realtime for live kanban updates.

---

### Third option: Neon + Drizzle ORM

If you want serverless PostgreSQL without Supabase's opinionated stack:

- **Neon** — serverless Postgres with branching (great for staging environments)
- **Drizzle ORM** — lightweight, TypeScript-native ORM with great Next.js integration
- Add **Clerk** for auth, **Uploadthing** for files, **Pusher** or **Ably** for realtime

More control, more pieces to wire together manually.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                 │
│         Next.js App Router + shadcn/ui              │
└───────────────────┬─────────────────────────────────┘
                    │ HTTPS
┌───────────────────▼─────────────────────────────────┐
│              Next.js Server (Vercel Edge)            │
│   • Server Components (data fetching)                │
│   • API Routes / Route Handlers (mutations)          │
│   • Middleware (auth session check)                  │
└───────────────────┬─────────────────────────────────┘
                    │
        ┌───────────▼───────────┐
        │      Supabase         │
        │  ┌─────────────────┐  │
        │  │  PostgreSQL DB  │  │
        │  ├─────────────────┤  │
        │  │  Auth (JWT)     │  │
        │  ├─────────────────┤  │
        │  │  File Storage   │  │
        │  ├─────────────────┤  │
        │  │  Realtime       │  │
        │  └─────────────────┘  │
        └───────────────────────┘
```

---

## Database Schema (PostgreSQL / Supabase)

### Core entities and relationships

```sql
-- Multi-tenancy: each law firm is an Organisation
organisations
  id, name, slug, plan, created_at

-- Users (staff members of an organisation)
users
  id, organisation_id → organisations
  email, full_name, role (admin | attorney | paralegal | staff)
  avatar_url, status (active | inactive)
  created_at

-- Clients
clients
  id, organisation_id → organisations
  first_name, last_name, email, phone
  nationality, date_of_birth, address
  status (Active | Pending | Inactive | Archived)
  assigned_to → users
  created_at, updated_at

-- Cases
cases
  id, organisation_id → organisations
  case_number (generated), title
  client_id → clients
  visa_type, status (Active | Pending | On Hold | Completed | Rejected)
  priority (Low | Medium | High | Urgent)
  assigned_to → users
  description, notes
  deadline, created_at, updated_at

-- Tasks
tasks
  id, organisation_id → organisations
  title, description
  case_id → cases (nullable)
  assigned_to → users
  status (To Do | In Progress | In Review | Completed)
  priority (Low | Medium | High | Urgent)
  due_date, created_at, updated_at

-- Documents
documents
  id, organisation_id → organisations
  client_id → clients
  case_id → cases (nullable)
  name, type (Identity | Employment | Immigration | Education | Financial | Supporting)
  file_url (Supabase Storage), file_size, mime_type
  status (Pending | Verified | Expired | Rejected)
  expiry_date, uploaded_by → users
  created_at

-- Appointments
appointments
  id, organisation_id → organisations
  client_id → clients
  case_id → cases (nullable)
  assigned_to → users
  title, type (Consultation | Document Review | Interview Prep | Follow-up)
  status (Scheduled | Confirmed | Completed | Cancelled)
  start_at, end_at, location, notes
  created_at

-- Invoices
invoices
  id, organisation_id → organisations
  invoice_number (generated)
  client_id → clients
  case_id → cases (nullable)
  status (Draft | Sent | Paid | Overdue)
  subtotal, tax_rate, tax_amount, total
  due_date, issued_at, paid_at
  notes, created_by → users
  created_at, updated_at

-- Invoice line items
invoice_items
  id, invoice_id → invoices
  description, quantity, unit_price, total

-- Payments
payments
  id, organisation_id → organisations
  invoice_id → invoices
  client_id → clients
  amount, currency
  method (Card | Bank Transfer | Cash | Check | Online)
  status (Completed | Pending | Failed | Refunded)
  reference, notes
  paid_at, created_at

-- Payment links
payment_links
  id, organisation_id → organisations
  invoice_id → invoices (nullable)
  client_id → clients
  amount, description
  status (Active | Expired | Used)
  url_token (unique), expires_at
  created_by → users, created_at

-- Comments / Activity (polymorphic)
comments
  id, organisation_id → organisations
  entity_type (case | task), entity_id
  author_id → users
  body, created_at

-- Settings per organisation
organisation_settings
  organisation_id → organisations (PK)
  case_stages (jsonb)          -- custom kanban columns
  booking_enabled, booking_url
  default_currency, tax_rate
  email_from_name, email_from_address
```

### Row-Level Security (Supabase RLS)

Every table has an `organisation_id`. RLS policies restrict all reads and writes to the requesting user's organisation, enforced at the database level — no application-layer filtering needed.

```sql
-- Example RLS policy for cases
create policy "Users see their organisation's cases"
  on cases for all
  using (organisation_id = auth.jwt() ->> 'organisation_id');
```

---

## Authentication

**Provider**: Supabase Auth (or Clerk if using Convex/Neon)

| Flow | Implementation |
|---|---|
| Sign up | Email + password; Google OAuth; GitHub OAuth |
| Sign in | Same providers; JWT session stored in httpOnly cookie |
| Session | Supabase `@supabase/ssr` — server-side session in Next.js middleware |
| Role check | `users.role` checked in middleware and Server Components |
| Forgot password | Supabase `resetPasswordForEmail` → magic link |
| Invite staff | Admin sends invite email; user completes registration |

---

## File Storage (Documents)

**Provider**: Supabase Storage (S3-backed)

```
Bucket: documents/
  {organisation_id}/
    {client_id}/
      {document_id}-{filename}
```

- Presigned URLs for client-side direct upload (avoids proxying files through Next.js)
- Signed URLs for secure download (expiry: 1 hour)
- File type validation server-side before generating upload URL
- Max file size: configurable per plan (default 25 MB)

---

## API Layer (Next.js Route Handlers)

All mutations go through Next.js Route Handlers (`/api/*`) — they validate auth, apply business logic, and call Supabase. Server Components read data directly via the Supabase server client.

```
POST   /api/clients
PATCH  /api/clients/:id
DELETE /api/clients/:id

POST   /api/cases
PATCH  /api/cases/:id
DELETE /api/cases/:id
PATCH  /api/cases/:id/status   (kanban drag)

POST   /api/tasks
PATCH  /api/tasks/:id
PATCH  /api/tasks/:id/status

POST   /api/documents/upload-url   (returns presigned URL)
DELETE /api/documents/:id

POST   /api/appointments
PATCH  /api/appointments/:id

POST   /api/invoices
PATCH  /api/invoices/:id
POST   /api/invoices/:id/send

POST   /api/payments
POST   /api/payment-links

GET    /api/reports/client/:id/pdf
```

---

## Realtime (Live Updates)

Using **Supabase Realtime** (Postgres change events via WebSocket):

```ts
// Subscribe to case status changes in kanban board
supabase
  .channel('cases')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'cases',
      filter: `organisation_id=eq.${orgId}` }, (payload) => {
    // Update local kanban state
  })
  .subscribe()
```

Subscriptions active on: `cases`, `tasks`, `appointments`, `invoices`

---

## PDF Report Generation

**Library**: `@react-pdf/renderer` (client-side) or `puppeteer` (server-side via API route)

Recommended: **`@react-pdf/renderer`** — no Chromium dependency, runs in Vercel Edge.

```
GET /api/reports/client/:id/pdf
  → Queries all cases, documents, payments for client
  → Streams PDF response
  → Downloaded as: ImmiVault_Report_{ClientName}_{Date}.pdf
```

---

## Email Notifications

**Provider**: Resend (or SendGrid)

Trigger points:
- New case assigned → attorney notified
- Task due in 24 hours → assignee reminded
- Invoice sent → client email with payment link
- Appointment confirmed/cancelled → client + staff notified
- Document expiry in 30 days → warning email

Templates stored in `organisation_settings.email_templates` (JSON), rendered server-side.

---

## Deployment

### Frontend + API — Vercel

```
Repository: GitHub
Deploy: Vercel (auto-deploy on push to main)
Preview environments: per pull request (Vercel preview URLs)
Environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### Database — Supabase Cloud

```
Plan: Free tier → Pro ($25/mo) when approaching limits
Region: us-east-1 (or match closest to client base)
Backups: Supabase daily backups (Pro); point-in-time recovery on Enterprise
Migrations: Supabase CLI (supabase db push) via GitHub Actions
```

### CI / CD Pipeline

```yaml
# .github/workflows/deploy.yml
on: push (main)
jobs:
  lint-typecheck:   npx tsc --noEmit && npx eslint
  supabase-migrate: supabase db push --db-url $DB_URL
  vercel-deploy:    vercel --prod
```

### Environments

| Environment | Branch | Database | URL |
|---|---|---|---|
| Production | `main` | Supabase prod project | immivault.com |
| Staging | `staging` | Supabase staging project | staging.immivault.com |
| Preview | PR branches | Supabase local / branch | vercel preview URL |

---

## Implementation Phases

### Phase 1 — Backend foundation (weeks 1–2)
- [ ] Supabase project setup: schema, RLS policies, seed data
- [ ] Auth integration: Supabase Auth + Next.js middleware session guard
- [ ] Replace mock data with real Supabase queries in Server Components
- [ ] Route Handlers for create / update / delete on all entities

### Phase 2 — Core features (weeks 3–4)
- [ ] File upload flow (presigned URL → Supabase Storage)
- [ ] Realtime kanban (Supabase channel subscriptions)
- [ ] PDF report generation
- [ ] Invoice → payment link → payment flow

### Phase 3 — Notifications & automation (weeks 5–6)
- [ ] Email notifications via Resend
- [ ] Automation rules engine (cron jobs via Vercel Cron or pg_cron)
- [ ] Client portal (separate `(portal)` route group, limited auth scope)

### Phase 4 — Production hardening (week 7)
- [ ] RLS audit — verify no data leaks between organisations
- [ ] Error monitoring (Sentry)
- [ ] Rate limiting on API routes
- [ ] Staging environment + smoke tests
- [ ] Custom domain + SSL on Vercel

---

## Convex vs Supabase — Final Verdict

| Factor | Convex | Supabase |
|---|---|---|
| Relational data model | Requires manual joins | Native SQL |
| Real-time DX | Excellent (reactive queries) | Good (channels) |
| File storage | Good | Excellent |
| Auth built-in | Needs Clerk | Yes |
| Multi-tenant RLS | Manual | Native |
| Complex reports / PDF | Harder | Straightforward (SQL) |
| Self-host option | No | Yes |
| Maturity | Newer | Battle-tested |
| **Recommendation for ImmiVault** | 2nd choice | **1st choice** |

If you want to proceed with Convex, the schema maps cleanly to Convex tables and the reactive query model gives a smoother real-time kanban experience. The trade-off is writing more application-level code to enforce relational integrity and access control.

**Bottom line**: Start with Supabase. If real-time collaboration (multiple attorneys editing the same case simultaneously) becomes a primary requirement later, Convex can be evaluated again at that point.
