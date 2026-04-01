# Plan: Fully Customizable Role & Permission System

> **Status: Shelved** — Current two-level system (Case Manager + Staff) is sufficient for now.
> Saved for future implementation if needed.

## Context
Replace hardcoded `case_manager`/`staff` permission tiers with an org-scoped, admin-configurable **levels** system. Each level has a name + 8 boolean permission toggles. Admins can rename, configure, or create additional levels. Backend enforcement is via permission flags resolved at auth time. All existing functionality (case–task relationships, notifications, scope/ownership rules, comments) is preserved unchanged.

---

## Core Design

### Key Rules
- **Admin** = fixed, hardcoded, never stored in levels. `ctx.user.role === "admin"` keeps working everywhere for admin-specific scope (comment delete-any, assignment changes, etc.).
- **Levels** = named sets of permission flags, stored in `organisationSettings.levels`. Default levels: Case Manager (`id: "case_manager"`) and Staff (`id: "staff"`).
- `users.levelId` maps a user to their level. Fallback: `user.role` (for existing users with no `levelId`).
- **Permissions resolved once at auth time**: auth wrapper loads org settings (one extra indexed read for non-admins), attaches `resolvedPermissions` to `ctx.user`. No denormalization needed.
- All **read/query access** is unchanged — only write mutations are affected.

### 8 Permission Flags
| Flag | Case Manager default | Staff default | Gates |
|------|:---:|:---:|---|
| `manageCases` | ✓ | ✗ | cases: create, edit, updateStatus, assign |
| `manageTasks` | ✓ | ✗ | tasks: create, edit, assign, delete |
| `manageClients` | ✗ | ✗ | clients: create, edit |
| `manageDocuments` | ✓ | ✗ | documents: generateUploadUrl, create, update, delete |
| `manageInvoices` | ✗ | ✗ | billing: createInvoice, updateInvoice, recordPayment, createPaymentLink |
| `manageAppointments` | ✓ | ✗ | appointments: create, update, updateStatus, delete |
| `manageStaff` | ✗ | ✗ | users: invite, edit (updateMember) |
| `manageSettings` | ✗ | ✗ | org settings, bank accounts, automations |

**Hardcoded admin-only (NOT toggleable):**
- `cases.remove`, `cases.assign` (dedicated `assign` mutation — case assignment)
- `clients.remove`
- `billing.removeInvoice`
- `comments.remove` (any comment — admins can delete all)
- `reactivateOrg`

**Staff task status exception (preserved as-is):** Staff can update task status on their own assigned tasks. This is a scope check, NOT a permission gate — stays regardless of `manageTasks`.

---

## Scope Check Rewrites

The current scope checks use `ctx.user.role === "case_manager"` as a proxy for "non-admin with write access." These must be generalized for custom levels:

| Location | Old check | New check | Reason |
|----------|-----------|-----------|--------|
| `cases update` — scope ownership | `role === "case_manager"` | `role !== "admin"` | All non-admins scoped to own assigned cases |
| `cases update` — allow assignment change | `role !== "case_manager"` | `role === "admin"` | Only admin can change `assignedTo` on a case |
| `cases updateStatus` — scope ownership | `role === "case_manager"` | `role !== "admin"` | Same: non-admins scoped to own cases |
| `tasks create` — scope ownership | `role === "case_manager"` | `role !== "admin"` | Non-admins can only create tasks in their own cases |
| `tasks update` — scope ownership | `role === "case_manager"` | `role !== "admin"` | Non-admins can only update tasks in their own cases |
| `tasks remove` — scope ownership | `role === "case_manager"` | `role !== "admin"` | Non-admins can only delete tasks in their own cases |
| `tasks updateStatus` — staff restriction | `role === "staff"` | `!resolvedPermissions.manageTasks` | Generalizes: anyone without manageTasks is scoped to own assigned tasks |
| `documents create/update/remove` — scope | `role === "case_manager"` | `role !== "admin"` | Non-admins scoped to own assigned cases |

**Unchanged checks (keep as-is):**
- `comments remove`: `ctx.user.role === "admin"` (admin deletes any comment — stays hardcoded)
- `notifications/actions.ts`: `assignee.role !== "admin"` (notification exclusion — stays hardcoded)

---

## Files to Create / Modify

### New File: `convex/lib/permissions.ts`
- `PERMISSION_KEYS` array (8 keys)
- `PermissionKey` type
- `PermissionSet` type (`Record<PermissionKey, boolean>`)
- `ALL_PERMISSIONS` (all true — admin)
- `NO_PERMISSIONS` (all false — baseline)
- `DEFAULT_CASE_MANAGER_PERMISSIONS`
- `DEFAULT_STAFF_PERMISSIONS`
- `DEFAULT_LEVELS` constant (replaces `DEFAULT_CUSTOM_ROLES`)

### Backend Changes (in order)

**`convex/schema.ts`**
- In `organisationSettings`: remove `customRoles`, add `levels: v.optional(v.array(v.object({ id, name, isDefault, permissions: v.object({...8 booleans}) })))`
- In `users`: `levelId` already present — no change

**`convex/lib/auth.ts`**
- Both `authenticatedQuery` and `authenticatedMutation` input functions:
  - Admin: `resolvedPermissions = ALL_PERMISSIONS` (no extra DB read)
  - Non-admin: load `organisationSettings` via `by_org` index → find level by `user.levelId ?? user.role` → attach `.permissions`
  - Fallback: `DEFAULT_CASE_MANAGER_PERMISSIONS` or `DEFAULT_STAFF_PERMISSIONS` if level not found
  - Return `{ ctx: { ...ctx, user: { ...user, resolvedPermissions } }, args: {} }`

**`convex/lib/rbac.ts`**
- Replace `requirePermission(ctx, resource, action)` → `requirePermission(ctx, key: PermissionKey)`:
  - If `ctx.user.role === "admin"` → return immediately (admin bypasses all flags)
  - Else: throw FORBIDDEN if `!ctx.user.resolvedPermissions[key]`
- Keep `requireAdmin(ctx)` unchanged
- Remove `requireAtLeastCaseManager` (all call sites replaced)

**`convex/organisations/mutations.ts`**
- Import `DEFAULT_LEVELS` from `../lib/permissions` (remove `DEFAULT_CUSTOM_ROLES`)
- `getOrCreateDefault`: seed `levels: DEFAULT_LEVELS`
- `updateSettings`: replace `customRoles` arg with `levels` arg (same structure + permissions object)

**`convex/seed.ts`**
- Import `DEFAULT_LEVELS` from `./lib/permissions` instead of `DEFAULT_CUSTOM_ROLES`

**`convex/users/actions.ts`** (`inviteStaff`)
- Read `settings.levels` instead of `settings.customRoles`

**`convex/users/mutations.ts`** (`updateMember`)
- Read `settings.levels` instead of `settings.customRoles`

**`convex/cases/mutations.ts`**
- `create`: `requireAdmin` → `requirePermission(ctx, "manageCases")`
- `update`: `requireAtLeastCaseManager` → `requirePermission(ctx, "manageCases")`; scope checks rewritten
- `updateStatus`: `requireAtLeastCaseManager` → `requirePermission(ctx, "manageCases")`; scope check rewritten
- `remove`: keep `requireAdmin` (hardcoded — not toggleable)
- `assign` (dedicated mutation): keep `requireAdmin` (hardcoded)

**`convex/tasks/mutations.ts`**
- `create`: `requireAtLeastCaseManager` → `requirePermission(ctx, "manageTasks")`; scope check rewritten
- `update`: `requireAtLeastCaseManager` → `requirePermission(ctx, "manageTasks")`; scope check rewritten
- `updateStatus`: replace `role === "staff"` with `!resolvedPermissions.manageTasks`
- `remove`: `requireAtLeastCaseManager` → `requirePermission(ctx, "manageTasks")`; scope check rewritten

**`convex/clients/mutations.ts`**
- `create` + `update`: `requireAdmin` → `requirePermission(ctx, "manageClients")`
- `remove`: keep `requireAdmin` (hardcoded)

**`convex/documents/mutations.ts`**
- All 4 mutations: `requireAtLeastCaseManager` → `requirePermission(ctx, "manageDocuments")`
- Scope checks rewritten

**`convex/appointments/mutations.ts`**
- All 4 mutations: `requireAtLeastCaseManager` → `requirePermission(ctx, "manageAppointments")`

**`convex/billing/mutations.ts`**
- `createInvoice`, `updateInvoice`, `recordPayment`, `createPaymentLink`: `requireAdmin` → `requirePermission(ctx, "manageInvoices")`
- `removeInvoice`: keep `requireAdmin` (hardcoded)

**`convex/bankAccounts/mutations.ts`**
- All: `requireAdmin` → `requirePermission(ctx, "manageSettings")`

**`convex/automationRules/mutations.ts`**
- All: `requireAdmin` → `requirePermission(ctx, "manageSettings")`

**`convex/organisations/mutations.ts`**
- `updateSettings` handler: `ctx.user.role !== "admin"` → `requirePermission(ctx, "manageSettings")`

**`convex/users/mutations.ts`**
- `updateMember` handler: `ctx.user.role !== "admin"` → `requirePermission(ctx, "manageStaff")`

**`convex/comments/mutations.ts`** — NO CHANGE

**`convex/notifications/actions.ts`** — NO CHANGE

### Frontend Changes

**`src/app/(app)/settings/role-types/page.tsx`** — Full rewrite:
- Fixed Admin row at top (all permissions on, locked/non-editable)
- For each level: editable name + 8 permission toggles (shadcn `Switch` components)
- Built-in levels (case_manager, staff): name editable, id locked
- Custom levels: fully editable + deletable
- Add new level form: name input + permission toggles (all off by default)
- Grouped UI: permission toggles in logical groups (Case Work, Documents, Finance, Admin)
- Save via `updateSettings({ levels: [...] })`

**`src/app/(app)/staff/invite-modal.tsx`** — `settings?.levels` instead of `settings?.customRoles`

**`src/app/(app)/staff/staff-modal.tsx`** — `settings?.levels` instead of `settings?.customRoles`

**`src/app/(app)/staff/page.tsx`** — `getRoleLabel` uses `settings?.levels`

---

## Modularity Notes
- **Adding a new permission flag later**: add key to `PermissionSet` + schema + defaults in `permissions.ts` + switch in UI.
- **Adding a new level**: UI action → `updateSettings({ levels: [...existing, newLevel] })`. Zero code changes.
- **Modifying level permissions**: UI toggles → `updateSettings`. Zero code changes.
- `requirePermission(ctx, key)` is a single-line flag lookup — independent of level count/names.

---

## Intentional Behavior Changes vs Current
1. **Case creation**: was `requireAdmin` → now `requirePermission(ctx, "manageCases")`. Case Manager default has `manageCases: true`, so case managers can create cases (more natural behavior).
2. **Scope checks**: `role === "case_manager"` → `role !== "admin"`. Any custom level with write access is scoped to own assigned cases.
3. **Task status update**: `role === "staff"` → `!resolvedPermissions.manageTasks`. Custom levels without manageTasks behave like staff.

---

## Verification Checklist
1. `npm run build` — zero TS errors
2. Existing case_manager users: same effective permissions
3. Existing staff users: still read-only + can update own assigned task status
4. Custom level with `manageClients: true` → can create clients
5. Custom level with `manageCases: false` → FORBIDDEN on case mutations
6. Admin: all operations work regardless of org levels
7. Case–task relationship intact
8. Notifications work unchanged
