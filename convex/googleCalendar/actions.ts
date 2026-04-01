"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Google Calendar API — uses direct HTTP fetch (no googleapis package needed).
// All actions are internal — never on the public API.
// ---------------------------------------------------------------------------

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

/** Exchange a refresh token for a fresh access token. */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google token refresh failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

/** Build a Google Calendar event body from appointment data. */
function buildEventBody(args: {
  title: string;
  startAt: number;
  endAt: number;
  notes?: string;
  attendeeEmails: string[];
  includeConference?: boolean; // false for offline/in-person appointments
}) {
  const includeConference = args.includeConference !== false;
  return {
    summary: args.title,
    description: args.notes ?? "",
    start: { dateTime: new Date(args.startAt).toISOString() },
    end: { dateTime: new Date(args.endAt).toISOString() },
    ...(includeConference
      ? {
          conferenceData: {
            createRequest: {
              requestId: `ordena-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }
      : {}),
    attendees: args.attendeeEmails.map((email) => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 60 },
        { method: "popup", minutes: 15 },
      ],
    },
  };
}

/** Create a Google Calendar event with a Meet link.
 *  Saves the eventId and Meet link back to the appointment. */
export const createEvent = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    creatorUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.runQuery(internal.appointments.queries.getById, {
      id: args.appointmentId,
    });
    if (!appt) return;

    const creator = await ctx.runQuery(internal.users.queries.getById, {
      id: args.creatorUserId,
    });
    if (!creator?.googleRefreshToken) return; // Not connected — skip silently

    try {
      const accessToken = await refreshAccessToken(creator.googleRefreshToken);

      const attendeeEmails = [
        creator.email, // Always include creator
        ...(appt.attendees ?? []).map((a: { email: string }) => a.email).filter((e: string) => e !== creator.email),
      ];

      const isOffline = appt.modality === "offline";
      const body = buildEventBody({
        title: appt.title,
        startAt: appt.startAt,
        endAt: appt.endAt,
        notes: appt.notes,
        attendeeEmails,
        includeConference: !isOffline,
      });

      const calUrl = isOffline
        ? `${GOOGLE_CALENDAR_BASE}/calendars/primary/events?sendUpdates=all`
        : `${GOOGLE_CALENDAR_BASE}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`;

      const res = await fetch(
        calUrl,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Google Calendar createEvent failed:", err);
        return;
      }

      const data = await res.json();
      const googleEventId: string = data.id;
      const meetLink: string =
        data.conferenceData?.entryPoints?.find(
          (ep: { entryPointType: string; uri: string }) => ep.entryPointType === "video"
        )?.uri ?? "";

      if (googleEventId) {
        await ctx.runMutation(internal.appointments.mutations.saveGoogleEventDetails, {
          id: args.appointmentId,
          googleMeetLink: meetLink,
          googleEventId,
        });
      }
    } catch (err) {
      console.error("createEvent error:", err);
    }
  },
});

/** Update a Google Calendar event when the appointment is edited. */
export const updateEvent = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    creatorUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.runQuery(internal.appointments.queries.getById, {
      id: args.appointmentId,
    });
    if (!appt?.googleEventId) return;

    const creator = await ctx.runQuery(internal.users.queries.getById, {
      id: args.creatorUserId,
    });
    if (!creator?.googleRefreshToken) return;

    try {
      const accessToken = await refreshAccessToken(creator.googleRefreshToken);

      const attendeeEmails = [
        creator.email,
        ...(appt.attendees ?? []).map((a: { email: string }) => a.email).filter((e: string) => e !== creator.email),
      ];

      const body = buildEventBody({
        title: appt.title,
        startAt: appt.startAt,
        endAt: appt.endAt,
        notes: appt.notes,
        attendeeEmails,
      });

      const res = await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/primary/events/${appt.googleEventId}?conferenceDataVersion=1&sendUpdates=all`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Google Calendar updateEvent failed:", err);
      }
    } catch (err) {
      console.error("updateEvent error:", err);
    }
  },
});

/** Cancel a Google Calendar event (sends cancellation emails to all invitees). */
export const cancelEvent = internalAction({
  args: {
    appointmentId: v.id("appointments"),
    creatorUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const appt = await ctx.runQuery(internal.appointments.queries.getById, {
      id: args.appointmentId,
    });
    if (!appt?.googleEventId) return;

    const creator = await ctx.runQuery(internal.users.queries.getById, {
      id: args.creatorUserId,
    });
    if (!creator?.googleRefreshToken) return;

    try {
      const accessToken = await refreshAccessToken(creator.googleRefreshToken);

      const res = await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/primary/events/${appt.googleEventId}?sendUpdates=all`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      // 204 = success, 410 = already deleted — both are fine
      if (!res.ok && res.status !== 410) {
        console.error("Google Calendar cancelEvent failed:", res.status);
      }
    } catch (err) {
      console.error("cancelEvent error:", err);
    }
  },
});
