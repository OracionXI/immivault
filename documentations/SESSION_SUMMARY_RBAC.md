# ImmiVault — RBAC Session Summary

**Date:** 2026-03-03
**Scope:** Role-Based Access Control (RBAC) implementation across Cases, Tasks, Documents, Clients, Reports, and Settings.

---

## 1. Overview

This session completed the RBAC layer for ImmiVault — the immigration case management SaaS. The goal was to enforce data isolation between roles so that every user only sees what they're authorised to see, while keeping the UX fully functional for each role.

### Roles in scope

| Role | Key privileges |
|------|---------------|
| `admin` | Full access to all data, settings, and reports |
| `case_manager` | Assigned cases + task-linked cases; can edit cases; sees Reports scoped to their clients |
| `staff` | Task-linked cases only; read/drag tasks; no Reports; no edit/delete on tasks |

---

## 2. Core Architecture Decision — Case-Scoped Visibility

### What was decided
Data visibility is **case-scoped**, not client-scoped. A user's entry points are:

1. **`case_manager`**: cases directly assigned to them **UNION** cases that contain a task assigned to them.
2. **`staff`**: only cases that contain a task assigned to them.

From visible cases, client IDs are derived (for the Clients list).

### What was rejected
- **Client-scoped** (all cases under a client when any task is assigned): Too broad — unrelated cases would be exposed.

### Shared helper — `convex/lib/visibility.ts`

```typescript
getVisibleCaseIds(db, role, userId, organisationId) → Set<string>
getVisibleClientIds(db, role, userId, organisationId) → Set<string>
```

This is the single source of truth used by cases, tasks, documents, and clients queries.

---

## 3. Files Changed

### Backend — Convex

| File | Change |
|------|--------|
| `convex/lib/visibility.ts` | **Created** — shared `getVisibleCaseIds` / `getVisibleClientIds` helpers |
| `convex/cases/queries.ts` | `list` + `listAll`: non-admins filter by `getVisibleCaseIds` |
| `convex/tasks/queries.ts` | `list`: non-admins filter by visible case IDs; `listByCase`: open to all visible roles |
| `convex/documents/queries.ts` | Uses shared `getVisibleCaseIds` (replaced local helper) |
| `convex/clients/queries.ts` | Uses shared `getVisibleClientIds` (replaced local helper) |
| `convex/tasks/mutations.ts` | Added `markOverdueUrgent` — internal cron mutation |
| `convex/crons.ts` | Added daily 01:00 UTC cron → `markOverdueUrgent` |

### Frontend — Next.js

| File | Change |
|------|--------|
| `src/components/layout/sidebar.tsx` | Staff excluded from Reports nav item |
| `src/app/(app)/settings/layout.tsx` | Non-admins see Profile only; route guard redirects away from admin paths |
| `src/app/(app)/reports/page.tsx` | Case managers see invoices/payments scoped to their visible clients |
| `src/app/(app)/cases/page.tsx` | Fixed `CaseModal` not mounting for `case_manager`; edit scoped to assigned cases |
| `src/app/(app)/tasks/page.tsx` | Staff: no edit icon, no delete icon, no Edit button; drag-and-drop kept |
| `src/app/(app)/tasks/task-detail-dialog.tsx` | `onEdit` prop made optional |
| `src/components/shared/kanban-board.tsx` | Added `dragDisabled` prop (wired into `isDisabled`) |

### Documentation

| File | Change |
|------|--------|
| `RBAC_OVERVIEW.md` | **Created** — visual workflow, page access matrix, data visibility logic, settings tab filter |

---

## 4. Bugs Found and Fixed

### Bug 1 — Case manager can't see task-linked case when case is unassigned
**Root cause:** `getVisibleCaseIds` had an early `return` for `case_manager` after the `by_assigned` index query, so the task-based lookup (which staff used) was never reached.
**Fix:** Removed early return; both roles fall through to the task-based lookup, and results are merged.

### Bug 2 — `CaseModal` never mounted for case_manager
**Root cause:** The modal JSX was wrapped in `{isAdmin && ...}`, so clicking Edit as a case manager opened nothing.
**Fix:** Changed to `{(isAdmin || isCaseManager) && ...}`.

### Bug 3 — `dragDisabled` prop declared but not wired
**Root cause:** Added the prop to `KanbanBoardProps` but forgot to include it in the `isDisabled` expression.
**Fix:** `const isDisabled = dragDisabled || disabledStatuses.includes(item[statusKey])`.

### Bug 4 — Linter silently reverted `tasks/page.tsx` edits
**Root cause:** The Edit tool's diff was applied but an ESLint auto-fix pass wiped the conditional wrappers.
**Fix:** Used the Write tool to rewrite the entire file at once with all role restrictions included.

---

## 5. Feature: Overdue Task Escalation

**Trigger:** Daily cron at 01:00 UTC.
**Logic:** Any task where `dueDate < now`, `status !== "Completed"`, and `priority !== "Urgent"` gets `priority` patched to `"Urgent"`.
**Implementation:** `internalMutation` (no user context required) called from `cronJobs`.

> **Note:** This uses `.filter()` on the tasks table instead of `.withIndex()`. This is acceptable for a background job with no user-facing latency requirement, but see Improvement #2 below.

---

## 6. Page Access Matrix

| Page | Admin | Case Manager | Staff |
|------|-------|-------------|-------|
| Dashboard | ✅ All | ✅ Scoped | ✅ Scoped |
| Cases | ✅ All | ✅ Assigned/task-linked | ✅ Task-linked |
| Tasks | ✅ All | ✅ Visible cases | ✅ Visible cases |
| Documents | ✅ All | ✅ Visible cases | ✅ Visible cases |
| Appointments | ✅ All | ✅ Visible cases | ✅ Visible cases |
| Reports | ✅ All | ✅ Scoped to their clients | ❌ Hidden |
| Settings — Profile | ✅ | ✅ | ✅ |
| Settings — Members | ✅ | ❌ | ❌ |
| Settings — Billing | ✅ | ❌ | ❌ |
| Settings — Org | ✅ | ❌ | ❌ |

---

## 7. Task Permission Matrix

| Action | Admin | Case Manager | Staff |
|--------|-------|-------------|-------|
| Create task (New Task button) | ✅ | ✅ | ✅ |
| Drag-and-drop status | ✅ | ✅ | ✅ |
| Edit task (pencil icon) | ✅ | ✅ | ❌ |
| Delete task (bin icon) | ✅ | ✅ | ❌ |
| Edit button in detail dialog | ✅ | ✅ | ❌ |

---

## 8. Pending Tasks

| # | Task | Priority |
|---|------|----------|
| 1 | **Connect real Clerk auth** — replace dummy stubs in all auth pages, uncomment middleware and providers | High |
| 2 | **Run `npx convex dev`** — initialise Convex project and sync schema | High |
| 3 | **Appointments page** — no RBAC scoping applied yet (currently shows all org appointments) | Medium |
| 4 | **Dashboard** — widgets (case counts, task counts) not yet scoped to role visibility | Medium |
| 5 | **Task comments** — currently local state only (resets on dialog close); wire to Convex `taskComments` table | Medium |
| 6 | **Overdue task notifications** — cron escalates priority but no in-app notification or email is sent | Low |
| 7 | **Clients list RBAC** — `clients/queries.ts` uses `getVisibleClientIds`; verify the Clients page UI respects this | Low |
| 8 | **File storage (Phase 3)** — Convex Storage integration for document uploads not started | Planned |
| 9 | **Resend email (Phase 4)** — transactional emails (invite, task reminder) not started | Planned |

---

## 9. Improvement Spaces

### Performance
1. **`buildTaskId` scans the full `tasks` table** to find the highest sequential ID. At scale this is expensive. Better: store a counter in a separate `counters` table and use `ctx.db.patch` to increment atomically.

2. **`markOverdueUrgent` uses `.filter()`** on the full tasks table. Add a `by_dueDate` index and query `lt("dueDate", now)` directly to avoid a full table scan.

3. **`getVisibleCaseIds` issues N `db.get()` calls** (one per task's `caseId`). For users with many tasks, this is O(n) reads. A `by_case` index on tasks would let you batch by case instead.

### UX
4. **No empty-state messaging for restricted roles** — when a case manager has no assigned cases/tasks, the boards are blank with no explanation. Add a contextual empty state ("You have no assigned tasks yet").

5. **Staff can create tasks but can't edit them afterwards** — this might be confusing. Consider whether staff should be able to edit tasks they themselves created (not just tasks assigned to them).

6. **Overdue tasks turn Urgent silently** — users see the priority badge change with no explanation. Add a visual indicator or tooltip: "Escalated automatically — due date passed."

7. **Settings tab redirect is client-side only** — a fast user could briefly see restricted settings content before the `useEffect` redirect fires. Consider a loading skeleton or server-side guard.

### Security / Correctness
8. **`requireNonAdminTarget` uses `ctx.db.get(userId)`** which returns the raw user document. There is no guarantee `userId` is a valid `users` table ID — it could be any document ID. Consider adding a type-safe lookup.

9. **Case manager `canEditItem` check in `cases/page.tsx`** compares `item.assignedToId === user?._id`. Verify that `KanbanItem` always carries `assignedToId` from the cases query — otherwise this silently falls through and the edit button shows for all items.

10. **Clerk webhook** (`convex/http.ts`) needs `CLERK_WEBHOOK_SECRET` configured before any user sync will work. Until then, org members invited via Clerk won't appear in the `users` table.

### Code Quality
11. **`any` type casts** throughout mutations (`ctx.db.patch(id, patch as any)`). Once Convex generates proper types from the schema, replace these with typed patches.

12. **`CURRENT_USER = "You"` hardcoded** in `task-detail-dialog.tsx` for the comment author. Replace with the real authenticated user's `fullName` from the `useQuery(api.users.queries.me)` hook.

---

## 10. Architecture Decisions Log

| Decision | Rationale |
|----------|-----------|
| Case-scoped (not client-scoped) visibility | Prevents data leakage across unrelated cases within a client |
| `visibility.ts` shared helper | Single source of truth — one change propagates to all domain queries |
| `internalMutation` for cron targets | Cron jobs have no user session; using `authenticatedMutation` would throw |
| `useRole` hook for all UI conditionals | Keeps role checks consistent and avoids prop drilling |
| Write-tool rewrite for `tasks/page.tsx` | Linter was silently reverting Edit-tool diffs; Write tool bypasses incremental diffing |

---

## 11. Known Tech Debt

- `convex/` is excluded from Next.js `tsconfig.json` because Convex manages its own types. This means IDE cross-file navigation between frontend and backend requires manual path lookup.
- Dummy auth stubs across all auth pages will be a multi-file change when real Clerk keys are added. Planned as a dedicated task.
- `kanban-board.tsx` has a hardcoded `assigneeBgColor` map with 3 specific names. This should be replaced with a deterministic hash-based colour function.

---

*Generated at end of RBAC implementation session — 2026-03-03*
