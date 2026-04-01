# ImmiVault — Role-Based Access Control

---

## Role Hierarchy

```
┌──────────────────────────────────────────────────────────┐
│                         ADMIN                            │
│         Full access to all pages and all org data        │
└──────────────────────────────────────────────────────────┘
                   │                    │
        ┌──────────┘                    └──────────┐
        ▼                                          ▼
┌─────────────────────────┐          ┌─────────────────────────┐
│      CASE MANAGER       │          │          STAFF          │
│  Sees cases assigned    │          │  Sees cases that have   │
│  directly to them       │          │  tasks assigned to them │
└─────────────────────────┘          └─────────────────────────┘
```

---

## Page / Nav Access

| Page           | Admin        | Case Manager      | Staff        |
|----------------|:------------:|:-----------------:|:------------:|
| Dashboard      | ✅            | ✅                 | ✅            |
| Clients        | ✅ (all)      | ❌                 | ❌            |
| Cases          | ✅ (all)      | ✅ (scoped)        | ✅ (scoped)   |
| Tasks          | ✅ (all)      | ✅ (scoped)        | ✅ (scoped)   |
| Documents      | ✅ (all)      | ✅ (scoped)        | ✅ (scoped)   |
| Appointments   | ✅            | ✅                 | ✅            |
| Billing        | ✅            | ❌                 | ❌            |
| Payments       | ✅            | ❌                 | ❌            |
| Reports        | ✅ (all)      | ✅ (scoped)        | ❌            |
| Staff          | ✅            | ❌                 | ❌            |
| Settings       | ✅ (all tabs) | ✅ (Profile only)  | ✅ (Profile only) |

---

## Data Visibility Logic

### Admin
```
ADMIN ──► All clients, cases, tasks, documents, invoices, payments in the org
```

---

### Case Manager — Case-scoped
```
CASE MANAGER
     │
     ├──► Cases directly assigned to me     ◄── entry point 1 (by_assigned on cases)
     │
     ├──► Cases containing tasks assigned   ◄── entry point 2 (by_assigned on tasks)
     │    to me (even if case is unassigned)
     │
     └──► (union of both sets)
               │
               ├──► All TASKS in those cases          (not just own tasks)
               │
               ├──► All DOCUMENTS in those cases
               │
               ├──► CLIENTS of those cases            (shown in client picker)
               │
               └──► REPORTS filtered to those clients (billing figures scoped)
```

---

### Staff — Task-scoped
```
STAFF
     │
     ▼
 Tasks assigned to me          ◄── entry point (by_assigned index)
     │
     ▼
 Cases that contain those tasks
     │
     ├──► All TASKS in those cases          (not just own tasks)
     │
     ├──► All DOCUMENTS in those cases
     │
     └──► CLIENTS of those cases            (shown in client picker)
```

---

## Settings Tabs

| Tab             | Admin | Case Manager      | Staff             |
|-----------------|:-----:|:-----------------:|:-----------------:|
| Profile         | ✅    | ✅                 | ✅                 |
| Case Stages     | ✅    | ❌ (→ redirected)  | ❌ (→ redirected)  |
| Booking         | ✅    | ❌ (→ redirected)  | ❌ (→ redirected)  |
| Bank Accounts   | ✅    | ❌ (→ redirected)  | ❌ (→ redirected)  |
| Email Templates | ✅    | ❌ (→ redirected)  | ❌ (→ redirected)  |
| Automations     | ✅    | ❌ (→ redirected)  | ❌ (→ redirected)  |

> Non-admins navigating directly to any admin-only settings URL are automatically
> redirected back to `/settings` (Profile page).

---

## Staff Invitation & Activation Flow

```
ADMIN                    CLERK                      NEW STAFF
  │                        │                            │
  │  inviteStaff(          │                            │
  │    email, role)        │                            │
  │  POST /v1/invitations ─►                            │
  │  public_metadata:      │                            │
  │  { convexRole,         │                            │
  │    convexOrgId }       │                            │
  │                        │──── Invitation Email ─────►│
  │                        │                            │
  │                        │                   Clicks link → /signup
  │                        │                            │
  │                        │◄─── user.created webhook ──│
  │                        │     reads public_metadata  │
  │                        │     creates Convex user    │
  │                        │     status: "inactive"     │
  │                        │                            │
  │                        │              ┌─────────────────────────┐
  │                        │              │  "Waiting for           │
  │                        │              │   Activation" screen    │
  │                        │              │  (polls every 3s)       │
  │                        │              └─────────────────────────┘
  │                        │                            │
  │  Staff page →          │                            │
  │  Edit → status: active │                            │
  │                        │                            │
  │                        │              Auto-redirects to Dashboard
```

---

## Staff Deletion Flow

```
ADMIN clicks "Remove" on a staff member
     │
     ▼
 1. cascadeUnassign
     ├── Clear assignedTo on all CASES belonging to that user
     └── Clear assignedTo on all TASKS belonging to that user
     │
     ▼
 2. DELETE /v1/users/{clerkUserId}     (Clerk — user can no longer sign in)
     │
     ▼
 3. db.delete(userId)                  (Convex — record removed)
```

---

## Key Rules Summary

| Rule | Detail |
|------|--------|
| Entry point for case_manager | Cases directly assigned to them |
| Entry point for staff | Tasks directly assigned to them |
| Scope | Case-scoped — see ALL tasks/docs in visible cases, but NOT sibling cases under the same client |
| Clients list | Derived from visible cases (non-admins only see clients they have a case in) |
| Reports | Case_manager sees reports scoped to their visible clients; staff has no access |
| Settings | All roles reach `/settings`; non-admins only see the Profile tab |
| Cascade on delete | Unassign cases + tasks before removing user from Clerk and Convex |
