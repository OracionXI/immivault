# ImmiVault — Logic & Role Documentation

> Last updated: 2026-03-08
> Stack: Next.js (App Router) · Convex · Clerk · Tailwind · shadcn/ui

---

## Table of Contents

1. [Roles & Permissions](#1-roles--permissions)
2. [Authentication & Multi-Tenancy](#2-authentication--multi-tenancy)
3. [Page-by-Page Logic](#3-page-by-page-logic)
   - [Dashboard](#dashboard)
   - [Cases](#cases)
   - [Tasks](#tasks)
   - [Clients](#clients)
   - [Documents](#documents)
   - [Settings](#settings)
4. [Backend Mutations & Queries](#4-backend-mutations--queries)
5. [Notification System](#5-notification-system)
6. [Cron Jobs](#6-cron-jobs)
7. [Archival System](#7-archival-system)
8. [Key Business Rules & Constraints](#8-key-business-rules--constraints)

---

## 1. Roles & Permissions

### Role Definitions

| Role | Description |
|------|-------------|
| `admin` | Full platform control. Manages clients, cases, tasks, documents, staff, settings. |
| `case_manager` | Manages their own assigned cases and the tasks/documents within them. |
| `staff` | View-only access to tasks assigned to them. Can update task status. |

### Permission Matrix

| Action | admin | case_manager | staff |
|--------|-------|--------------|-------|
| **Clients** — create / edit / delete | ✅ | ❌ | ❌ |
| **Clients** — view | ✅ | ✅ (own cases only) | ✅ (own cases only) |
| **Cases** — create / delete | ✅ | ❌ | ❌ |
| **Cases** — edit / move status | ✅ | ✅ (own assigned) | ❌ |
| **Cases** — view | ✅ | ✅ (own assigned + task-linked) | ✅ (task-linked) |
| **Tasks** — create / delete | ✅ | ✅ (own cases only) | ❌ |
| **Tasks** — edit / move status | ✅ | ✅ (own cases only) | ✅ (own assigned — status only) |
| **Tasks** — view | ✅ | ✅ (own cases) | ✅ (own assigned) |
| **Documents** — upload / delete | ✅ | ✅ (own cases only) | ❌ |
| **Documents** — view | ✅ | ✅ (own cases) | ✅ (own cases) |
| **Comments** — create | ✅ | ✅ | ✅ |
| **Comments** — edit | own only | own only | own only |
| **Comments** — delete | ✅ any | own only | own only |
| **Settings** — all tabs | ✅ | ❌ | ❌ |
| **Settings** — Profile tab | ✅ | ✅ | ✅ |
| **Staff** — invite / manage | ✅ | ❌ | ❌ |
| **Notifications** — view / mark read | own only | own only | own only |

### RBAC Enforcement

All permission checks happen **server-side** in Convex via `convex/lib/rbac.ts`:

- `requireAdmin(ctx)` — throws `FORBIDDEN` if role ≠ admin
- `requireAtLeastCaseManager(ctx)` — throws `FORBIDDEN` if role is staff
- `requireCaseManagerTarget(user)` — validates an assignee must have role `case_manager`
- `requireNonAdminTarget(user)` — validates an assignee must not be admin

Frontend uses `useRole()` hook to conditionally render buttons and guard pages:
```
useRole() → { role, isAdmin, isCaseManager, isStaff, user, isLoading }
```

---

## 2. Authentication & Multi-Tenancy

### User Status Lifecycle

```
signup → pending_onboarding → (admin activates) → active
invite  → inactive          → (user accepts)    → active
```

| Status | Description |
|--------|-------------|
| `pending_onboarding` | Created via manual signup; awaits admin activation |
| `inactive` | Invited but not yet logged in / activated |
| `active` | Fully operational account |

### Tenancy Model

- Every table has `organisationId` — all queries are scoped to the user's org.
- Users cannot see data from other organisations.
- Clerk is the auth provider. JWT is validated to extract `tokenIdentifier`.
- `authenticatedMutation` / `authenticatedQuery` wrappers inject `ctx.user` and throw `UNAUTHENTICATED` if missing or inactive.

### Data Visibility Scoping

**Cases visible to a user:**
- **Admin** — all cases in org
- **Case Manager** — cases directly assigned to them + cases containing tasks assigned to them
- **Staff** — cases that contain tasks assigned to them

**Clients visible** — derived from visible cases (client is visible if any of their cases are visible).

**Tasks/Documents visible** — all items within the user's visible cases.

---

## 3. Page-by-Page Logic

---

### Dashboard

**Path:** `/dashboard`
**Access:** All roles

**Data displayed:**
- Total Clients (count)
- Active Cases (count)
- Pending Tasks (count)
- Monthly Revenue
- Upcoming Appointments
- Overdue Invoices

**Widgets:**
- Recent Cases — linked to client name
- Pending Tasks — with due dates
- Upcoming Appointments — with type
- Recent Clients — with email

All widgets respect role-based visibility (e.g. case manager sees only their assigned cases).

---

### Cases

**Path:** `/cases`
**Access:** All roles (read), Admin/Case Manager (write)

#### Layout
Kanban board with columns. **5 columns are fixed and always present:**

| Column | Color | Notes |
|--------|-------|-------|
| To Do | Amber | Default status for new cases |
| In Progress | Blue | — |
| On Hold | Orange | — |
| Completed | Emerald | Sets `completedAt` timestamp; expires linked documents |
| Archive | Slate | User-facing archive stage |

Admins can add custom columns in Settings → Case Stages. Custom columns appear after the fixed 5.

#### Features by Role

| Feature | Admin | Case Manager | Staff |
|---------|-------|--------------|-------|
| Create new case | ✅ | ❌ | ❌ |
| Edit case (modal) | ✅ | ✅ (own assigned) | ❌ |
| Delete case | ✅ | ❌ | ❌ |
| Drag case to new column | ✅ | ✅ (own assigned) | ❌ |
| View case detail dialog | ✅ | ✅ | ✅ |
| Add / edit comments | ✅ | ✅ | ✅ |
| Delete any comment | ✅ | ❌ | ❌ |

#### Case Detail Dialog — Tabs

| Tab | Content |
|-----|---------|
| Notes | Free-text notes field on the case |
| Tasks | Tasks linked to this case (inline list) |
| Documents | Documents linked to case; click to view file |
| Activity | Comments/activity feed with @mention support |

#### Special Logic

- **Auto-open from notification:** URL param `?open=<caseId>` opens the detail dialog for that case, then clears the param.
- **Moving to Completed:** Sets `completedAt = Date.now()` and sets all linked documents to `status: "Expired"`.
- **Moving away from Completed:** Clears `completedAt`.
- **Case number format:** `IMV-YYYYMMDD-XXXX` (random 4-char suffix).

#### Case Assignment Rules
- Only users with role `case_manager` can be assigned to a case (never admin or staff).
- Replacing or clearing the assignee **cascades unassign** to all tasks in that case that belonged to the old manager (`assignedTo = undefined`).

---

### Tasks

**Path:** `/tasks`
**Access:** All roles (read), Admin/Case Manager (write)

#### Layout
Kanban board with **4 fixed columns:** To Do → In Progress → In Review → Completed.

#### Features by Role

| Feature | Admin | Case Manager | Staff |
|---------|-------|--------------|-------|
| Create task | ✅ | ✅ (own cases only) | ❌ |
| Edit task | ✅ | ✅ (own cases only) | ❌ |
| Delete task | ✅ | ✅ (own cases only) | ❌ |
| Drag task to new status | ✅ | ✅ (own cases only) | ✅ (own assigned — status only) |
| View task detail | ✅ | ✅ | ✅ |
| Add comments | ✅ | ✅ | ✅ |

#### Task Requirements (enforced frontend + backend)
- Must be linked to a case (`caseId` required)
- Must have a due date (`dueDate` required)
- Assignee must be `case_manager` or `staff` (never admin)
- Case manager can only create tasks in their own assigned cases

#### Task ID Format
Sequential per org: `TASK-0001`, `TASK-0002`, etc.

#### Special Logic
- **Auto-open from notification:** URL param `?open=<taskId>` opens detail dialog.
- **Overdue detection:** If `dueDate < now` and status ≠ Completed → red highlight on card.
- **Moving to Completed:** Sets `completedAt = Date.now()`.
- **Daily cron at 01:00 UTC:** Escalates overdue tasks to `priority: "Urgent"`.
- **Daily cron at 07:00 UTC:** Sends reminder notifications to assignees for tasks due tomorrow.

---

### Clients

**Path:** `/clients`
**Access:** Admin only (others redirected to `/dashboard`)

#### Layout
Table view with search, sort, and filter by status.

**Columns:** Name, Email, Phone, Nationality, Status, Actions

#### Features

| Feature | Admin |
|---------|-------|
| Create client | ✅ |
| Edit client | ✅ |
| Delete client (hard delete) | ✅ (requires typing "CONFIRM") |
| Archive / unarchive client | ✅ |

#### Auto-Case Creation
When a client is created, **an unassigned case is automatically created** with:
- Title: `<firstName> <lastName> — New Case`
- Status: `To Do`
- Priority: `Medium`
- No assignee

#### Client Status Values
`Active` | `Pending` | `Inactive` | `Archived`

#### Archive / Unarchive Cascade

**Archiving a client:**
1. All linked cases → `status: "Archived"`
2. All tasks in those cases → `hidden: true`

**Unarchiving a client:**
1. All linked cases → `status: "To Do"`
2. All tasks in those cases → `hidden: false`, `status: "To Do"`, `assignedTo: undefined`

#### Hard Delete Cascade
Deleting a client permanently deletes all linked cases, tasks, and documents.

---

### Documents

**Path:** `/documents`
**Access:** All roles (read), Admin/Case Manager (write)

#### Layout
Table view: Document name, type, related case, client, upload date, status.

#### Document Types
`Identity` | `Employment` | `Immigration` | `Education` | `Financial` | `Supporting`

#### Document Status
| Status | When |
|--------|------|
| `Verified` | Always on creation |
| `Expired` | When linked case moves to "Completed" |

#### Features by Role

| Feature | Admin | Case Manager | Staff |
|---------|-------|--------------|-------|
| Upload document | ✅ | ✅ (own cases only) | ❌ |
| Delete document | ✅ | ✅ (own cases only) | ❌ |
| View / download | ✅ | ✅ | ✅ |

#### Upload Flow (2-Step)
1. Call `generateUploadUrl()` → receive signed Convex Storage URL
2. POST file directly to storage URL
3. Call `documents.create()` with `storageId` + metadata

`clientId` is derived server-side from the `caseId` (admin cannot pass a mismatched client).

#### Special Logic
- **Auto-open viewer from notification:** URL param `?doc=<docId>` opens the document viewer inline, then clears the param.
- Uploading a document triggers `document_uploaded` notification to the case's assigned manager.

---

### Settings

**Path:** `/settings/*`
**Access:** Admin only (except Profile tab)

#### Tabs

| Tab | Path | Who Can Access | Purpose |
|-----|------|----------------|---------|
| Profile | `/settings` | All roles | Edit user profile details |
| Case Stages | `/settings/case-stages` | Admin | Manage Kanban columns |
| Case Types | `/settings/case-types` | Admin | Define visa types and sub-issues |
| Booking | `/settings/booking` | Admin | Appointment booking config |
| Bank Accounts | `/settings/bank-accounts` | Admin | Payment bank details |
| Email Templates | `/settings/email-templates` | Admin | Customise email content |
| Automations | `/settings/automations` | Admin | Workflow automation rules |

Non-admins accessing admin-only paths are redirected to `/settings` (Profile).

#### Case Stages Logic

**Fixed stages** (always present, non-removable):
- To Do, In Progress, On Hold, Completed, Archive

**Custom stages** — admin can add unlimited additional columns.

Storage: `organisationSettings.caseStages` stores **only custom stage names**. Fixed stages are always prepended in the UI and never saved to DB.

#### Case Types Logic

- Admin defines visa types (e.g., `H-1B`, `EB-3`)
- Each visa type has a list of sub-issues (e.g., `H-1B → ["Labor Cert", "I-140", "I-485"]`)
- Used in the case creation modal for cascaded dropdowns
- Stored in `organisationSettings.caseTypes` as `{ id, name, issues[] }[]`

---

## 4. Backend Mutations & Queries

### Cases

| Mutation | Role Required | Key Logic |
|----------|--------------|-----------|
| `cases.create` | Admin | Generates case number; validates assignee is case_manager; triggers notifications |
| `cases.update` | Admin / Case Manager (own) | Assignee change triggers cascade unassign on tasks |
| `cases.updateStatus` | Admin / Case Manager (own) | Sets/clears `completedAt`; expires documents on → Completed |
| `cases.remove` | Admin | Hard delete; cascades tasks + documents |

| Query | Role Required | Key Logic |
|-------|--------------|-----------|
| `cases.list` | All | Returns cases scoped to visibility rules |
| `cases.getById` | All | Returns single case if visible to user |

### Clients

| Mutation | Role Required | Key Logic |
|----------|--------------|-----------|
| `clients.create` | Admin | Auto-creates linked case with status "To Do" |
| `clients.update` | Admin | Archive/unarchive cascades to cases + tasks |
| `clients.remove` | Admin | Hard delete; cascades all linked data |

### Tasks

| Mutation | Role Required | Key Logic |
|----------|--------------|-----------|
| `tasks.create` | Admin / Case Manager | Case manager restricted to own cases; auto-generates taskId |
| `tasks.update` | Admin / Case Manager | Sets `completedAt` on → Completed |
| `tasks.updateStatus` | Admin / Case Manager / Staff (own) | Drag-and-drop status update |
| `tasks.remove` | Admin / Case Manager | Hard delete |

### Documents

| Mutation | Role Required | Key Logic |
|----------|--------------|-----------|
| `documents.generateUploadUrl` | Case Manager+ | Returns signed Convex Storage URL |
| `documents.create` | Case Manager+ | Derives clientId from case; status = Verified; triggers notification |
| `documents.remove` | Case Manager+ | Deletes storage blob + DB record |

### Comments

| Mutation | Role Required | Key Logic |
|----------|--------------|-----------|
| `comments.create` | All | Triggers mention + comment notifications |
| `comments.update` | Author only | |
| `comments.remove` | Author or Admin | Admin can delete any; others only own |

### Notifications

| Mutation | Role Required | Key Logic |
|----------|--------------|-----------|
| `notifications.insert` | Internal only | Server-side triggered by other mutations |
| `notifications.markRead` | Recipient only | Mark single notification as read |
| `notifications.markAllRead` | Recipient only | Mark all unread as read |

### Organisations

| Mutation | Role Required | Key Logic |
|----------|--------------|-----------|
| `organisations.updateSettings` | Admin | Updates caseStages, caseTypes, config |
| `organisations.completeOnboarding` | Raw (signup flow) | Sets org name, slug, agreement signature; activates user |
| `organisations.reactivateOrg` | Admin | Clears `deletedAt` soft-delete flag |

### Users

| Mutation | Role Required | Key Logic |
|----------|--------------|-----------|
| `users.syncFromClerk` | Internal (webhook) | Creates/updates user; sets default status |
| `users.updateFromClerk` | Internal (webhook) | Syncs email, fullName, avatar from Clerk |

---

## 5. Notification System

### Trigger Types

| Type | When Triggered | Recipient(s) | Deep Link |
|------|---------------|--------------|-----------|
| `case_created` | New case created | All admins | `/cases?open=<id>` |
| `case_assigned` | Case assigned to user | Assignee | `/cases?open=<id>` |
| `case_status_changed` | Case status changed | Assignee + admins | `/cases?open=<id>` |
| `case_deadline` | Case deadline within 48 hours | Assignee | `/cases?open=<id>` |
| `task_assigned` | Task assigned to user | Assignee | `/tasks?open=<id>` |
| `task_status_changed` | Task status changed | Task assignee | `/tasks?open=<id>` |
| `task_overdue` | Task past due date | Task assignee | `/tasks?open=<id>` |
| `comment` | Comment posted on case/task | Entity assignee | `/cases?open=<id>` or `/tasks?open=<id>` |
| `mention` | User @mentioned in comment | Mentioned user | Same as comment |
| `document_uploaded` | Document added to a case | Case assignee | `/documents?doc=<id>` |

### Bell Component Behaviour

- Badge shows unread count (capped at 99+)
- Clicking a notification navigates to the relevant page with URL param
- The target page reads the param, opens the detail dialog/viewer, then clears the URL
- "Mark all read" button in popover

### @Mention Support

Available @mention targets inside case/task comments:
- `@<person>` — users linked to the case (assignee + task assignees)
- `@<document>` — documents linked to the case

Mentions parsed server-side; each mentioned user gets a `mention` notification.

---

## 6. Cron Jobs

All crons defined in `convex/crons.ts` and run as `internalMutation` / `internalAction`.

| Time (UTC) | Job | Description |
|------------|-----|-------------|
| Daily 07:00 | `sendTaskReminders` | Notify assignees of tasks due tomorrow |
| Daily 01:00 | `markOverdueUrgent` | Escalate overdue tasks to `priority: "Urgent"` |
| Daily 06:00 | `sendCaseDeadlineReminders` | Notify assignees of case deadlines within 48h |
| Daily 02:00 | `archiveCompletedCases` | Auto-archive Completed cases older than 40 days |
| Daily 00:00 | `markOverdueInvoices` | Set past-due invoices to Overdue status |

---

## 7. Archival System

### User-Facing Archive (Manual)

The **Archive** column on the Cases Kanban is a normal user-controllable status. A case manager or admin drags a case to "Archive". This is separate from the automated archival below.

### Automated Case Archival (Cron — 40-day rule)

**Trigger:** Daily at 02:00 UTC
**Condition:** Case `status === "Completed"` AND `completedAt < now - 40 days`

**Flow:**

```
archiveCompletedCases (cron)
  └─ For each qualifying case:
       └─ scheduler.runAfter(generateArchivalReport)
            └─ Fetch case, client, manager, tasks
            └─ Generate PDF report (jsPDF + jspdf-autotable)
                 ├─ Client Details section
                 ├─ Case Details section
                 ├─ Assigned Manager section
                 └─ Tasks table
            └─ Store PDF in Convex Storage
            └─ finalizeArchival()
                 ├─ Delete all tasks for the case
                 ├─ Delete all comments for the case
                 └─ Patch case: status → "Archived", archivedReportStorageId → <storageId>
```

**PDF contents:**
- Client: name, email, phone, nationality, DOB, address
- Case: number, title, visa type, status, priority, created date, completed date, deadline, description
- Manager: name, email
- Tasks table: task name, task ID, completion date

**Note:** `"Archived"` (automated) is a different string from `"Archive"` (user-facing column). No conflict.

### Client Archival Cascade (Manual)

When admin sets a client to `Archived` status:
1. All linked cases → `status: "Archived"`
2. All tasks in those cases → `hidden: true`

When admin unarchives a client:
1. All linked cases → `status: "To Do"`
2. All tasks in those cases → `hidden: false`, `status: "To Do"`, `assignedTo: undefined`

---

## 8. Key Business Rules & Constraints

| Rule | Where Enforced |
|------|----------------|
| Case assignee must have role `case_manager` | Backend (`requireCaseManagerTarget`) |
| Task assignee must not be admin | Backend (`requireNonAdminTarget`) |
| Case manager can only manage own assigned cases | Backend (ownership check) |
| Replacing case assignee clears old manager's tasks | Backend (`unassignCaseManagerTasks`) |
| Auto-case created on client creation | Backend (`clients.create`) |
| Auto-case starts with status "To Do" | Backend (`clients.create`) |
| Document status set to Expired when case Completes | Backend (`cases.updateStatus`) |
| Only comment author can edit; admin can delete any | Backend (`comments.update/remove`) |
| Settings tabs (except Profile) are admin-only | Frontend (`useRole`) + layout guard |
| Fixed Kanban stages cannot be removed | Frontend only (UI enforcement) |
| Org data fully isolated by `organisationId` | All Convex queries |
| Inactive/pending users are blocked from the API | `authenticatedMutation` wrapper |
| Tasks require `caseId` + `dueDate` | Frontend validation + backend |
| Hard deletes are permanent (no soft-delete for cases/tasks/docs) | Backend |
| Org soft-delete via `deletedAt` field | Schema + cron (organisations only) |
