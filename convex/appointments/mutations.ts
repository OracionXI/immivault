import { authenticatedMutation } from "../lib/auth";
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAtLeastCaseManager, requireAdmin } from "../lib/rbac";
import { internal } from "../_generated/api";

// Reasonable date bounds: year 2000–2100
const MIN_DATE_MS = new Date("2000-01-01T00:00:00Z").getTime();
const MAX_DATE_MS = new Date("2100-01-01T00:00:00Z").getTime();
const MAX_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function validateAppointmentTimes(startAt: number, endAt: number) {
  if (startAt < MIN_DATE_MS || startAt > MAX_DATE_MS || endAt < MIN_DATE_MS || endAt > MAX_DATE_MS) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Appointment date is out of the valid range (2000–2100)." });
  }
  if (endAt - startAt > MAX_DURATION_MS) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Appointment cannot exceed 24 hours." });
  }
}

const statusValidator = v.union(
  v.literal("Upcoming"),
  v.literal("Ongoing"),
  v.literal("Expired"),
  v.literal("Cancelled")
);

// Appointment types are user-configurable via Settings → Appt Types.
// We accept any string here; built-in defaults include the values below.
const typeValidator = v.string(); // validated at handler level (max 200)

const attendeeValidator = v.object({
  type: v.union(v.literal("internal"), v.literal("external")),
  userId: v.optional(v.id("users")),
  email: v.string(), // validated at handler level (max 254)
  name: v.string(),  // validated at handler level (max 200)
});

/** Admin, Case Manager, or Accountant (general meetings only): create an appointment. */
export const create = authenticatedMutation({
  args: {
    title: v.string(),
    meetingType: v.union(v.literal("case_appointment"), v.literal("general_meeting")),
    type: typeValidator,
    clientId: v.optional(v.id("clients")),
    caseId: v.optional(v.id("cases")),
    assignedTo: v.optional(v.id("users")),
    startAt: v.number(),
    endAt: v.number(),
    attendees: v.optional(v.array(attendeeValidator)),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role === "staff") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Case manager or admin privileges required." });
    }
    if (ctx.user.role === "accountant" && args.meetingType !== "general_meeting") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Accountants can only create general meetings." });
    }

    if (args.startAt >= args.endAt) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Appointment end time must be after start time." });
    }
    validateAppointmentTimes(args.startAt, args.endAt);

    const titleTrimmed = args.title.trim();
    if (titleTrimmed.length === 0 || titleTrimmed.length > 255) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Appointment title must be between 1 and 255 characters." });
    }
    if (args.type.trim().length === 0 || args.type.length > 200) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Appointment type must be between 1 and 200 characters." });
    }
    if (args.notes !== undefined && args.notes.length > 5000) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Notes cannot exceed 5000 characters." });
    }
    if (args.attendees !== undefined) {
      if (args.attendees.length > 200) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot have more than 200 attendees." });
      }
      for (const att of args.attendees) {
        if (att.email.length > 254 || att.name.length > 200) {
          throw new ConvexError({ code: "BAD_REQUEST", message: "Attendee email or name exceeds maximum length." });
        }
      }
    }

    // Case managers can only create case_appointments for cases assigned to them
    if (ctx.user.role === "case_manager" && args.meetingType === "case_appointment" && args.caseId) {
      const c = await ctx.db.get(args.caseId);
      if (!c || c.organisationId !== ctx.user.organisationId || c.assignedTo !== ctx.user._id) {
        throw new ConvexError({ code: "FORBIDDEN", message: "You can only create appointments for your own cases." });
      }
    }

    // Validate that internal attendees belong to the same organisation
    if (args.attendees) {
      for (const att of args.attendees) {
        if (att.type === "internal" && att.userId) {
          const u = await ctx.db.get(att.userId);
          if (!u || u.organisationId !== ctx.user.organisationId) {
            throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid attendee: user does not belong to your organisation." });
          }
        }
      }
    }

    const appointmentId = await ctx.db.insert("appointments", {
      ...args,
      organisationId: ctx.user.organisationId,
      createdBy: ctx.user._id,
      assignedTo: args.assignedTo ?? ctx.user._id,
      status: "Upcoming",
      attendees: args.attendees ?? [],
    });

    // Fire-and-forget: create Google Calendar event + send notifications
    await ctx.scheduler.runAfter(0, internal.googleCalendar.actions.createEvent, {
      appointmentId,
      creatorUserId: ctx.user._id,
    });
    await ctx.scheduler.runAfter(0, internal.appointments.jobs.notifyCreated, {
      appointmentId,
      creatorId: ctx.user._id,
    });

    return appointmentId;
  },
});

/** Admin, Case Manager, or Accountant (own general meetings only): update an appointment. */
export const update = authenticatedMutation({
  args: {
    id: v.id("appointments"),
    title: v.optional(v.string()),
    type: v.optional(typeValidator),
    clientId: v.optional(v.id("clients")),
    caseId: v.optional(v.id("cases")),
    assignedTo: v.optional(v.id("users")),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
    attendees: v.optional(v.array(attendeeValidator)),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role === "staff") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Case manager or admin privileges required." });
    }

    const appt = await ctx.db.get(args.id);
    if (!appt || appt.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment not found." });
    }

    if (ctx.user.role === "accountant" && appt.meetingType !== "general_meeting") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Accountants can only manage general meetings." });
    }

    // Only the creator or an admin can edit
    if (ctx.user.role !== "admin" && appt.createdBy !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the appointment creator or an admin can edit this appointment." });
    }

    if (appt.status === "Cancelled" || appt.status === "Expired") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot edit a cancelled or expired appointment." });
    }

    const effectiveStart = args.startAt ?? appt.startAt;
    const effectiveEnd = args.endAt ?? appt.endAt;
    if (effectiveStart >= effectiveEnd) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Appointment end time must be after start time." });
    }
    validateAppointmentTimes(effectiveStart, effectiveEnd);

    if (args.title !== undefined) {
      const t = args.title.trim();
      if (t.length === 0 || t.length > 255) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Appointment title must be between 1 and 255 characters." });
      }
    }
    if (args.type !== undefined && (args.type.trim().length === 0 || args.type.length > 200)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Appointment type must be between 1 and 200 characters." });
    }
    if (args.notes !== undefined && args.notes.length > 5000) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Notes cannot exceed 5000 characters." });
    }
    if (args.attendees !== undefined) {
      if (args.attendees.length > 200) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot have more than 200 attendees." });
      }
      for (const att of args.attendees) {
        if (att.email.length > 254 || att.name.length > 200) {
          throw new ConvexError({ code: "BAD_REQUEST", message: "Attendee email or name exceeds maximum length." });
        }
      }
    }

    const { id, ...fields } = args;
    const timeChanged = fields.startAt !== undefined || fields.endAt !== undefined;

    await ctx.db.patch(id, fields);

    // Sync Google Calendar event if time or attendees changed (skip portal-created appts with no createdBy)
    if (appt.googleEventId && appt.createdBy && (timeChanged || fields.attendees !== undefined || fields.title !== undefined)) {
      await ctx.scheduler.runAfter(0, internal.googleCalendar.actions.updateEvent, {
        appointmentId: id,
        creatorUserId: appt.createdBy,
      });
    }

    // Notify attendees of the change
    await ctx.scheduler.runAfter(0, internal.appointments.jobs.notifyUpdated, {
      appointmentId: id,
      updatedById: ctx.user._id,
    });
  },
});

/** Admin, Case Manager, or Accountant (own general meetings only): cancel an appointment. */
export const cancel = authenticatedMutation({
  args: { id: v.id("appointments") },
  handler: async (ctx, args) => {
    if (ctx.user.role === "staff") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Case manager or admin privileges required." });
    }

    const appt = await ctx.db.get(args.id);
    if (!appt || appt.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment not found." });
    }

    if (ctx.user.role === "accountant" && appt.meetingType !== "general_meeting") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Accountants can only manage general meetings." });
    }

    if (ctx.user.role !== "admin" && appt.createdBy !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the appointment creator or an admin can cancel this appointment." });
    }

    if (appt.status === "Cancelled") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Appointment is already cancelled." });
    }

    await ctx.db.patch(args.id, {
      status: "Cancelled",
      deletedAt: Date.now(),
    });

    // Cancel Google Calendar event (sends cancellation to all invitees; skip portal-created appts)
    if (appt.googleEventId && appt.createdBy) {
      await ctx.scheduler.runAfter(0, internal.googleCalendar.actions.cancelEvent, {
        appointmentId: args.id,
        creatorUserId: appt.createdBy,
      });
    }

    await ctx.scheduler.runAfter(0, internal.appointments.jobs.notifyCancelled, {
      appointmentId: args.id,
      cancelledById: ctx.user._id,
    });
  },
});

/** Admin only: hard delete an appointment. */
export const remove = authenticatedMutation({
  args: { id: v.id("appointments") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const appt = await ctx.db.get(args.id);
    if (!appt || appt.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Appointment not found." });
    }
    await ctx.db.delete(args.id);
  },
});

/** Internal: save Google Meet link + event ID after Google Calendar event creation. */
export const saveGoogleEventDetails = internalMutation({
  args: {
    id: v.id("appointments"),
    googleMeetLink: v.string(),
    googleEventId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      googleMeetLink: args.googleMeetLink,
      googleEventId: args.googleEventId,
    });
  },
});

/** Internal: auto-transition appointment statuses (called by cron every 5 min). */
export const transitionStatuses = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Upcoming → Ongoing: process up to 500 per run; cron cadence catches the rest.
    const upcoming = await ctx.db
      .query("appointments")
      .filter((q) => q.eq(q.field("status"), "Upcoming"))
      .take(500);

    for (const appt of upcoming) {
      if (appt.startAt <= now) {
        await ctx.db.patch(appt._id, { status: "Ongoing" });
      }
    }

    // Ongoing → Expired: process up to 500 per run.
    const ongoing = await ctx.db
      .query("appointments")
      .filter((q) => q.eq(q.field("status"), "Ongoing"))
      .take(500);

    for (const appt of ongoing) {
      if (appt.endAt <= now) {
        await ctx.db.patch(appt._id, {
          status: "Expired",
          deletedAt: appt.deletedAt ?? Date.now(),
        });
      }
    }
  },
});

/** Internal: hard-delete appointments soft-deleted more than 40 days ago (called by daily cron). */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago

    // Cap at 500 per run to prevent memory/timeout issues on large tables.
    const toDelete = await ctx.db
      .query("appointments")
      .withIndex("by_deleted_at", (q) => q.lt("deletedAt", cutoff))
      .take(500);

    for (const appt of toDelete) {
      await ctx.db.delete(appt._id);
    }
  },
});
