import { authenticatedMutation } from "../lib/auth";
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAtLeastCaseManager, requireAdmin } from "../lib/rbac";
import { internal } from "../_generated/api";

const statusValidator = v.union(
  v.literal("Upcoming"),
  v.literal("Ongoing"),
  v.literal("Expired"),
  v.literal("Cancelled")
);

// Appointment types are user-configurable via Settings → Appt Types.
// We accept any string here; built-in defaults include the values below.
const typeValidator = v.string();

const attendeeValidator = v.object({
  type: v.union(v.literal("internal"), v.literal("external")),
  userId: v.optional(v.id("users")),
  email: v.string(),
  name: v.string(),
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

    const { id, ...fields } = args;
    const timeChanged = fields.startAt !== undefined || fields.endAt !== undefined;

    await ctx.db.patch(id, fields);

    // Sync Google Calendar event if time or attendees changed
    if (appt.googleEventId && (timeChanged || fields.attendees !== undefined || fields.title !== undefined)) {
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

    // Cancel Google Calendar event (sends cancellation to all invitees)
    if (appt.googleEventId) {
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

    // Upcoming → Ongoing (startAt has passed but endAt hasn't)
    const upcoming = await ctx.db
      .query("appointments")
      .filter((q) => q.eq(q.field("status"), "Upcoming"))
      .collect();

    for (const appt of upcoming) {
      if (appt.startAt <= now) {
        await ctx.db.patch(appt._id, { status: "Ongoing" });
      }
    }

    // Ongoing → Expired (endAt has passed)
    const ongoing = await ctx.db
      .query("appointments")
      .filter((q) => q.eq(q.field("status"), "Ongoing"))
      .collect();

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

    const toDelete = await ctx.db
      .query("appointments")
      .withIndex("by_deleted_at")
      .filter((q) =>
        q.and(
          q.neq(q.field("deletedAt"), undefined),
          q.lt(q.field("deletedAt"), cutoff)
        )
      )
      .collect();

    for (const appt of toDelete) {
      await ctx.db.delete(appt._id);
    }
  },
});
