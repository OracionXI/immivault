import { internalMutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";

/**
 * Client-facing: update their own profile fields and mark profile as complete.
 * Email is admin-controlled and excluded. firstName/lastName are client-editable.
 */
export const updateClientProfile = internalMutation({
  args: {
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    prefix: v.optional(v.string()),
    middleName: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    maritalStatus: v.optional(v.string()),
    languagePreference: v.optional(v.string()),
    nationality: v.optional(v.string()),
    countryOfBirth: v.optional(v.string()),
    passportNumber: v.optional(v.string()),
    mobilePhone: v.optional(v.string()),
    address: v.optional(v.string()),
    markComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { clientId, organisationId, markComplete, ...fields } = args;

    if (fields.prefix !== undefined && fields.prefix.length > 20)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Prefix cannot exceed 20 characters." });
    if (fields.maritalStatus !== undefined && fields.maritalStatus.length > 50)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Marital status cannot exceed 50 characters." });
    if (fields.languagePreference !== undefined && fields.languagePreference.length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Language preference cannot exceed 100 characters." });
    if (fields.firstName !== undefined && fields.firstName.trim().length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "First name cannot exceed 100 characters." });
    if (fields.lastName !== undefined && fields.lastName.trim().length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Last name cannot exceed 100 characters." });
    if (fields.middleName !== undefined && fields.middleName.length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Middle name cannot exceed 100 characters." });
    if (fields.nationality !== undefined && fields.nationality.length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nationality cannot exceed 100 characters." });
    if (fields.countryOfBirth !== undefined && fields.countryOfBirth.length > 100)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Country of birth cannot exceed 100 characters." });
    if (fields.passportNumber !== undefined && fields.passportNumber.length > 50)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Passport number cannot exceed 50 characters." });
    if (fields.mobilePhone !== undefined && fields.mobilePhone.length > 50)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Mobile phone cannot exceed 50 characters." });
    if (fields.address !== undefined && fields.address.length > 500)
      throw new ConvexError({ code: "BAD_REQUEST", message: "Address cannot exceed 500 characters." });

    const client = await ctx.db.get(clientId);
    if (!client || client.organisationId !== organisationId) return;
    await ctx.db.patch(clientId, {
      ...fields,
      ...(markComplete ? { profileCompleted: true } : {}),
    });
  },
});

/** Mark all notifications as read for a client. */
export const markAllNotificationsRead = internalMutation({
  args: { clientId: v.id("clients"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const unread = await ctx.db
      .query("portalNotifications")
      .withIndex("by_client_unread", (q) => q.eq("clientId", args.clientId).eq("read", false))
      .collect();
    await Promise.all(
      unread
        .filter((n) => n.organisationId === args.organisationId)
        .map((n) => ctx.db.patch(n._id, { read: true }))
    );
  },
});

/** Insert a portal notification (used by staff-side mutations to notify clients). */
export const insertPortalNotification = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("portalNotifications", {
      ...args,
      read: false,
    });
  },
});

/** Upsert appointment pricing for a type. Admin-facing — called from HTTP route. */
export const upsertAppointmentPricing = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    appointmentType: v.string(),
    priceInCents: v.number(),
    currency: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appointmentPricing")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect()
      .then((list) => list.find((p) => p.appointmentType === args.appointmentType));

    if (existing) {
      await ctx.db.patch(existing._id, {
        priceInCents: args.priceInCents,
        currency: args.currency,
        description: args.description,
        isActive: args.isActive,
      });
    } else {
      await ctx.db.insert("appointmentPricing", args);
    }
  },
});

/** Delete appointment pricing for a type. */
export const deleteAppointmentPricing = internalMutation({
  args: { id: v.id("appointmentPricing"), organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record || record.organisationId !== args.organisationId) return;
    await ctx.db.delete(args.id);
  },
});
