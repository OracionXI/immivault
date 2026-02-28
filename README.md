# ImmiVault

Professional immigration case management platform for attorneys and law firms.

## Overview

ImmiVault centralises case tracking, client management, document handling, scheduling, billing, and team coordination into a single workflow. Built for immigration practices that need structured, auditable operations.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix UI) |
| Drag & Drop | @hello-pangea/dnd |
| Icons | Lucide React |

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Summary stats, recent activity |
| `/clients` | Client list — searchable, filterable table |
| `/cases` | Case kanban board with priority lanes |
| `/tasks` | Task kanban board with assignee/priority filters |
| `/documents` | Document library with type filter |
| `/appointments` | Appointment calendar/table |
| `/billing` | Invoice management |
| `/payments` | Transaction history + payment links |
| `/reports` | Client & firm-level reports (PDF export) |
| `/staff` | Staff management |
| `/settings/*` | Profile, case stages, booking, bank accounts, email templates, automations |
| `/login` | Authentication |
| `/signup` | Registration |
| `/forgot-password` | Password reset |

## UI Conventions

- **Kanban boards** — drag-and-drop columns; click card to open Jira-style detail dialog (description + activity/comments); edit/delete actions on each card
- **Tables** — fixed-width columns (no shifting on filter), search bar (50% width), dropdown filter, result count
- **Modals** — blurred backdrop, full validation, Cancel/X to close
- **Badges** — colour-coded status/priority across all entities
- **Dark mode** — full support via `next-themes`
- **Responsive** — mobile-first layout, sidebar collapses on small screens

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/dashboard`.

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, signup, forgot-password (split-screen layout)
│   ├── (app)/           # All authenticated pages (sidebar layout)
│   └── layout.tsx       # Root layout (ThemeProvider only)
├── components/
│   ├── layout/          # AppLayout, sidebar, header
│   ├── shared/          # KanbanBoard, DataTable
│   └── ui/              # shadcn/ui primitives
└── lib/
    ├── types.ts          # Domain types
    └── mock-data.ts      # Placeholder data (replaced by API calls)
```

## Design Rules

- Reusable components — no redundancy
- Light & dark mode on all surfaces
- All pages fully responsive
- Confirmation dialogs before destructive actions
- Form validation on all required fields
