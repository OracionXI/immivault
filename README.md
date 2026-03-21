# Ordena

General-purpose CRM for law firms — case tracking, client management, document handling, scheduling, billing, and team coordination in a single workflow.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix UI) |
| Backend | Convex (database, storage, real-time, cron) |
| Auth | Clerk |
| Email | Resend |
| Payments | Stripe |
| Drag & Drop | @hello-pangea/dnd |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Icons | Lucide React |

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Summary stats, week-over-week trends, upcoming appointments |
| `/clients` | Client list — searchable, filterable table |
| `/cases` | Case kanban board with priority lanes |
| `/tasks` | Task kanban board with assignee/priority filters |
| `/documents` | Document library with type filter and signed download URLs |
| `/appointments` | Appointment calendar/table with Google Meet integration |
| `/billing` | Invoice management with line items and PDF export |
| `/payments` | Transaction history, payment links, Stripe checkout |
| `/reports` | Client and firm-level reports |
| `/staff` | Staff management and role assignment |
| `/settings/profile` | User profile and Google Calendar connection |
| `/settings/case-settings` | Case stages and types |
| `/settings/case-stages` | Kanban column order |
| `/settings/booking` | Public booking page configuration |
| `/settings/bank-accounts` | Bank account management |
| `/settings/email-templates` | Custom email templates |
| `/settings/role-types` | Custom role configuration |
| `/settings/appointment-types` | Appointment type management |
| `/settings/doc-types` | Document type management |
| `/login` | Authentication (Clerk) |
| `/signup` | Registration (Clerk) |
| `/onboarding` | First-run org setup for new admins |
| `/invite` | Staff invitation acceptance |
| `/pay/[token]` | Public payment page (no auth required) |
| `/verify` | Email verification |
| `/waiting` | Pending activation screen for invited staff |

## Roles

| Role | Access |
|---|---|
| `admin` | Full access — all clients, cases, tasks, billing, staff management |
| `case_manager` | Own assigned cases + all tasks within them |
| `staff` | Cases where they have assigned tasks; can only edit their own tasks |
| `accountant` | All clients/cases (read) + full billing access; no delete on invoices |

## Architecture

- **Convex** handles all backend logic — mutations, queries, cron jobs, file storage, and scheduled actions.
- **Clerk** provides authentication and manages invitations. A webhook syncs user creation/updates to Convex.
- Every Convex query/mutation goes through `authenticatedQuery` / `authenticatedMutation` wrappers that enforce org isolation — all data is scoped to `organisationId`.
- Role-based visibility via `getVisibleCaseIds` / `getVisibleClientIds` helpers in `convex/lib/visibility.ts`.
- Notifications are fired as scheduled actions after every mutation and support in-app + email delivery.

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, signup, onboarding (split-screen layout)
│   ├── (app)/           # All authenticated pages (sidebar layout)
│   └── layout.tsx       # Root layout (ThemeProvider + ConvexProvider)
├── components/
│   ├── layout/          # AppLayout, sidebar, header, notification bell
│   ├── shared/          # Reusable domain components
│   └── ui/              # shadcn/ui primitives
└── lib/
    └── types.ts         # Domain types

convex/
├── lib/                 # auth, rbac, visibility, rateLimit helpers
├── clients/             # queries + mutations
├── cases/               # queries + mutations
├── tasks/               # queries + mutations
├── documents/           # queries + mutations
├── appointments/        # queries + mutations + jobs
├── billing/             # queries + mutations + actions + jobs
├── notifications/       # queries + mutations + actions + jobs
├── comments/            # queries + mutations
├── users/               # queries + mutations + actions
├── organisations/       # queries + mutations + jobs
├── archival/            # queries + mutations + actions
├── dashboard/           # queries
├── googleCalendar/      # actions
├── bankAccounts/        # queries + mutations
├── emailTemplates/      # queries + mutations
└── crons.ts             # Scheduled job registry
```

## Getting Started

```bash
npm install
npx convex dev     # starts Convex dev server + generates types
npm run dev        # starts Next.js on http://localhost:3000
```

Required environment variables (`.env.local`):

```
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWT_ISSUER_DOMAIN=
CLERK_WEBHOOK_SECRET=
```

## UI Conventions

- **Kanban boards** — drag-and-drop columns; click card to open detail dialog with description and activity feed
- **Tables** — fixed-width columns, search bar, dropdown filters, result count
- **Modals** — blurred backdrop, full validation, Cancel/X to close
- **Badges** — colour-coded status/priority across all entities
- **Dark mode** — full support via `next-themes`
- **Responsive** — mobile-first layout, sidebar collapses on small screens
- **Toasts** — Sonner for success/error feedback

## Design Rules

- Reusable components — no redundancy
- Light and dark mode on all surfaces
- All pages fully responsive
- Confirmation dialogs before destructive actions
- Form validation on all required fields
