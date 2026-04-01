# Appointments + Google Calendar — Implementation Plan

## Overview

Full redesign of the appointments feature:
- Role-based visibility (Admin = all org appointments, Case Manager = own only)
- Google Meet links via per-user Google Calendar OAuth (each staff member connects their own Google account)
- Attendees: internal staff (dropdown) + external people (email input)
- Appointment types: case-linked or standalone "General Meeting"
- Auto-status transitions via cron: Upcoming → Ongoing → Expired
- Soft delete with 40-day hard purge cron
- In-app + email notifications (Resend) + Google Calendar invite
- Calendar UI: custom month-view below the table, built with date-fns (no new dependencies)

---

## Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| Google OAuth approach | Per-user OAuth (each case manager connects own Google account) | Professional: invites come from the case manager's real email |
| Google API calls | Direct HTTP fetch (no `googleapis` package) | Works in Convex edge runtime, no extra dependency |
| OAuth callback | Next.js API route `/api/google-callback` | Simpler than Convex HTTP endpoint, works in both dev + prod |
| Calendar UI | Custom month-view built with date-fns | date-fns already installed, avoids heavy react-big-calendar / FullCalendar |
| Past appointments | Soft-delete on cancel/expire, hard-delete after 40 days | Audit trail preserved |
| Status model | `Upcoming → Ongoing → Expired`, `Cancelled` (separate) | Auto-transitioned by cron |

---

## Environment Variables Required

Add to `.env.local` and Vercel dashboard:

```
GOOGLE_CLIENT_ID=           # from Google Cloud Console
GOOGLE_CLIENT_SECRET=       # from Google Cloud Console
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://immivault.vercel.app/api/google-callback
# For local dev: http://localhost:3000/api/google-callback
```

Google Cloud Console setup:
1. Create a project at console.cloud.google.com
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials (Web Application type)
4. Add authorized redirect URIs: both the prod URL and `http://localhost:3000/api/google-callback`

---

## Schema Changes

### `appointments` table
**Added fields:**
- `meetingType: "case_appointment" | "general_meeting"` — drives title behavior and case requirement
- `type`: extended with `"General Meeting"` literal
- `clientId`: changed from required → optional (General Meetings don't need a client)
- `attendees`: `Array<{ type: "internal"|"external", userId?: Id<"users">, email: string, name: string }>`
- `googleMeetLink?: string` — Google Meet URL populated after event creation
- `googleEventId?: string` — Google Calendar event ID for sync/update/cancel
- `createdBy: Id<"users">` — for permission checks (only creator or admin can edit/cancel)
- `deletedAt?: number` — soft delete timestamp (set on cancel or expire)

**Changed status values:**
- Old: `Scheduled | Confirmed | Completed | Cancelled`
- New: `Upcoming | Ongoing | Expired | Cancelled`
- Auto-transitioned by cron; `Cancelled` is manually set

**New indexes:**
- `by_assigned` on `[assignedTo]` — for case manager scoped queries
- `by_created_by` on `[createdBy]` — for ownership queries
- `by_deleted_at` on `[deletedAt]` — for purge cron
- `by_org_and_start` on `[organisationId, startAt]` — for calendar range queries

### `users` table
**Added fields:**
- `googleRefreshToken?: string` — encrypted OAuth refresh token
- `googleEmail?: string` — the connected Google account email
- `googleConnectedAt?: number` — epoch ms of when they connected

### `notifications` table
**Added types:**
- `appointment_created` — notify all attendees
- `appointment_updated` — notify all attendees when time/details change
- `appointment_cancelled` — notify all attendees when cancelled

---

## Backend Architecture

### `convex/appointments/mutations.ts`

**`create`** (requireAtLeastCaseManager)
- Sets `createdBy = ctx.user._id`
- Sets `assignedTo = ctx.user._id` if not provided
- Sets default status `"Upcoming"`
- Sets `endAt = startAt + 3600000` if not provided (1-hour default)
- Schedules `googleCalendar.actions.createEvent` (non-blocking, uses creator's refresh token)
- Schedules `appointments.jobs.notifyCreated`

**`update`** (requireAtLeastCaseManager)
- Only creator or admin can update
- If `startAt`/`endAt` changed, schedules `googleCalendar.actions.updateEvent`
- Schedules `appointments.jobs.notifyUpdated` if attendees need to know

**`cancel`** (requireAtLeastCaseManager)
- Only creator or admin can cancel
- Sets `status = "Cancelled"`, `deletedAt = Date.now()`
- Schedules `googleCalendar.actions.cancelEvent`
- Schedules `appointments.jobs.notifyCancelled`

**`remove`** (requireAdmin only) — hard delete for admin cleanup

**`purgeExpired`** (internalMutation) — hard-deletes records where `deletedAt < now - 40 days`

**`transitionStatuses`** (internalMutation) — transitions Upcoming→Ongoing→Expired based on current time

### `convex/appointments/queries.ts`

**`list`**
- Admin: all org appointments excluding hard-purged
- Case manager: appointments where `createdBy === me` OR `assignedTo === me` OR `me` is in `attendees`
- Optional `includeExpired` param (defaults false — hides Expired/Cancelled from main table)

**`listUpcoming`** — `Upcoming` and `Ongoing` only, ordered by `startAt`

**`checkConflict`** — returns overlapping appointments for a given user + time range (for warning UI)

**`getById`** — single appointment with org guard

### `convex/googleCalendar/actions.ts`

All use direct `fetch` to Google APIs (no googleapis package):

- `getAuthUrl(userId)` — builds Google OAuth URL with scopes:
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/calendar`
- `createEvent(args)` — creates Google Calendar event with `conferenceDataVersion: 1` (generates Meet link), returns `{ eventId, meetLink }`
- `updateEvent(args)` — PATCH event title/time/description
- `cancelEvent(args)` — DELETE event from creator's calendar (sends cancellation to all invitees)
- `refreshAccessToken(refreshToken)` — internal helper to get fresh access token before API calls

### `convex/appointments/jobs.ts`

Internal actions for notifications:
- `notifyCreated` — in-app + email to all internal attendees
- `notifyUpdated` — in-app + email to all attendees when appointment changes
- `notifyCancelled` — in-app + email (internal) + email only (external/clients, no app access)

Internal mutations for cron:
- `transitionStatuses` — Upcoming→Ongoing→Expired sweep
- `purgeExpired` — 40-day hard delete sweep

### `convex/users/mutations.ts` additions

- `saveGoogleTokens` — saves `googleRefreshToken`, `googleEmail`, `googleConnectedAt` for ctx.user
- `disconnectGoogle` — clears Google fields for ctx.user

### `src/app/api/google-callback/route.ts` (Next.js)

1. Reads `code` + `state` (= Convex userId) from query params
2. POSTs to `https://oauth2.googleapis.com/token` to exchange code for tokens
3. Calls Convex `users.mutations.saveGoogleTokens` via Convex HTTP client
4. Returns HTML page that calls `window.opener.postMessage('google-connected', '*')` and closes

---

## Frontend Architecture

### Settings > Google Calendar (`/settings/google-calendar`)

- Shows: "Google Calendar not connected" or "Connected as john@gmail.com (since Mar 15, 2026)"
- "Connect Google Calendar" button → opens popup `/api/google-start`
- Popup listens for `postMessage('google-connected')` → refreshes state
- "Disconnect" button → calls `users.mutations.disconnectGoogle`

Add to settings sidebar navigation.

### Appointments Page (`/appointments`)

**Top section — Table:**
- Role-aware title ("My Appointments" for case managers, "All Appointments" for admin)
- Columns: Title | Type | Case | Date & Time | Duration | Attendees | Meet Link | Status | Actions
- "New Appointment" button (blocked for staff role)
- Filter by: Status, Type
- Skeleton loading (no flash of empty state)
- Edit/Cancel buttons (only visible to creator or admin)

**Bottom section — Calendar:**
- Month view by default
- Navigate months with < > arrows
- Days with appointments show colored dot badges (one per appointment)
- Clicking a day shows a popover listing appointments for that day
- Click an appointment in popover → opens detail/edit modal
- Skeleton loading state while data loads

### Appointment Modal (`/appointments/appointment-modal.tsx`)

**Gate:** If creator has no Google account connected → show banner "Connect Google Calendar to create appointments" with link to settings. Block form submission.

**Form fields:**
1. Meeting Type toggle: "Case Appointment" | "General Meeting"
2. Title: auto-generated + disabled for case appointments (e.g. "Case #1042 – John Smith"), free text for general
3. Case selector (only shown for case appointments) — auto-populates client
4. Client (auto-populated from case, read-only for case appointments; hidden for general)
5. Attendees multi-select:
   - Internal: searchable dropdown of active staff
   - External: email + name input with "Add" button
   - Chips for added attendees with remove button
6. Date picker + Time picker
7. Duration selector (15min, 30min, 45min, 1h, 1.5h, 2h — default 1h)
8. Notes textarea
9. **Conflict warning banner**: shows if any attendee has an overlapping appointment (non-blocking, just warns)
10. Submit: "Create & Send Invites" / "Save Changes"

---

## Crons Added to `convex/crons.ts`

```
// Every 5 min — transition appointment statuses
crons.interval("appointment status transitions", { minutes: 5 }, internal.appointments.jobs.transitionStatuses)

// Daily at 03:00 UTC — purge expired/cancelled appointments older than 40 days
crons.daily("purge expired appointments", { hourUTC: 3, minuteUTC: 0 }, internal.appointments.jobs.purgeExpired)
```

---

## Notification Types Added

| Type | Who receives | Channel |
|---|---|---|
| `appointment_created` | All internal attendees (except creator) | In-app + Email |
| `appointment_created` | External attendees / clients | Email only |
| `appointment_updated` | All attendees (except updater) | In-app + Email (internal), Email only (external) |
| `appointment_cancelled` | All attendees (except canceller) | In-app + Email (internal), Email only (external) |

Google Calendar invites are sent automatically by Google when the event is created/updated/cancelled via the Calendar API — no extra work needed for calendar attendees.

---

## Implementation Order

1. Schema updates (appointments + users + notifications)
2. Backend: mutations + queries
3. Backend: Google Calendar actions
4. Backend: appointment jobs (notifications + cron handlers)
5. Backend: cron updates + user mutations
6. Frontend: OAuth callback route + `api/google-start` route
7. Frontend: Settings > Google Calendar page
8. Frontend: Appointment modal rewrite
9. Frontend: Appointments page rewrite (table + calendar)
10. Build verification

---

## Migration Note

The `appointments` status field is changing from `Scheduled|Confirmed|Completed|Cancelled` to `Upcoming|Ongoing|Expired|Cancelled`. Any existing test appointments in Convex will have invalid statuses after the schema change. Run this one-time in the Convex dashboard or via a seed script to migrate:

```javascript
// In Convex dashboard > Functions > run
// Map old → new: Scheduled→Upcoming, Confirmed→Upcoming, Completed→Expired
```

If there's no production data yet, simply drop and recreate the table via `npx convex dev`.
