import { internalMutation, mutation } from "../_generated/server";
import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { checkRateLimit } from "../lib/rateLimit";

/** Default roles seeded for every new organisation. Admin is always fixed; only
 *  case_manager and staff are included here as configurable defaults. */
export const DEFAULT_CUSTOM_ROLES = [
  { id: "case_manager", name: "Case Manager", permissionLevel: "case_manager" as const, isDefault: true },
  { id: "staff",        name: "Staff",         permissionLevel: "staff"        as const, isDefault: true },
  { id: "accountant",   name: "Accountant",    permissionLevel: "accountant"   as const, isDefault: true },
];

/**
 * Gets the existing organisation or creates a default one.
 * Called by the user.created webhook for the first admin signup
 * when there is no organisationId in the Clerk user's public_metadata.
 * Creates a temporary placeholder — the real name is set in /onboarding.
 */
export const getOrCreateDefault = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Always create a fresh org for each new admin signup.
    // Slug is made unique with a timestamp so concurrent signups don't collide.
    const orgId = await ctx.db.insert("organisations", {
      name: "Pending Setup",
      slug: `pending-setup-${Date.now()}`,
      plan: "free",
    });

    await ctx.db.insert("organisationSettings", {
      organisationId: orgId,
      defaultCurrency: "USD",
      taxRate: 0,
      customRoles: DEFAULT_CUSTOM_ROLES,
    });

    return orgId;
  },
});

/**
 * Completes the onboarding flow for a manual admin signup.
 * This is a raw mutation (not authenticatedMutation) because the user
 * is still in "pending_onboarding" status when they call it.
 *
 * - Verifies the caller is authenticated and in pending_onboarding status
 * - Updates the organisation name, slug, and agreement details
 * - Sets the user status to "active"
 */
export const completeOnboarding = mutation({
  args: {
    orgName: v.string(),
    agreementSignature: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated." });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "USER_NOT_FOUND",
        message: "User profile not found. Please contact support.",
      });
    }

    if (user.status !== "pending_onboarding") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Onboarding already completed.",
      });
    }

    const orgName = args.orgName.trim();
    if (orgName.length < 2 || orgName.length > 100) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Organisation name must be between 2 and 100 characters.",
      });
    }

    const sig = args.agreementSignature.trim();
    const isDataUrl = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig);
    const isTypedName = sig.length >= 2 && sig.length <= 100;
    if (!isDataUrl && !isTypedName) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Agreement signature must be a typed name (2–100 characters) or a PNG data URL.",
      });
    }

    // Generate a URL-safe slug from the org name.
    // If the name contains only special characters the regex may produce an
    // empty string — fall back to a random hex suffix to guarantee non-empty.
    const rawSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
    const baseSlug = rawSlug.length > 0
      ? rawSlug
      : `org-${Math.random().toString(36).slice(2, 10)}`;

    // Ensure slug uniqueness by appending a counter if necessary
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await ctx.db
        .query("organisations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (!existing || existing._id === user.organisationId) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Update organisation with the real name and agreement record
    await ctx.db.patch(user.organisationId, {
      name: orgName,
      slug,
      agreementSignature: args.agreementSignature,
      agreementSignedAt: Date.now(),
    });

    // Activate the user and mark them as the org founder
    await ctx.db.patch(user._id, { status: "active", isFounder: true });
  },
});

/** Updates the organisation's settings record. Admin only. */
export const updateSettings = authenticatedMutation({
  args: {
    caseStages: v.optional(v.array(v.string())),
    caseColumnOrder: v.optional(v.array(v.string())),
    caseTypes: v.optional(v.array(
      v.object({ id: v.string(), name: v.string(), issues: v.array(v.string()) })
    )),
    defaultCurrency: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    documentTypes: v.optional(v.array(v.string())),
    appointmentTypes: v.optional(v.array(v.string())),
    timezone: v.optional(v.string()),
    officeHours: v.optional(v.array(v.object({
      dayOfWeek: v.number(),
      startHour: v.number(),
      endHour: v.number(),
      isActive: v.boolean(),
    }))),
    customRoles: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      permissionLevel: v.union(v.literal("case_manager"), v.literal("staff"), v.literal("accountant")),
      isDefault: v.boolean(),
    }))),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    // Limit settings changes: 60 updates per hour per org to prevent automated abuse.
    await checkRateLimit(ctx, `updateSettings:${ctx.user.organisationId}`, 60, 3_600_000);
    const settings = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .unique();
    if (!settings) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisation settings not found." });
    }

    // ── Input bounds ────────────────────────────────────────────────────────
    if (args.caseStages !== undefined && args.caseStages.length > 100) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot have more than 100 case stages." });
    }
    if (args.caseTypes !== undefined && args.caseTypes.length > 100) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot have more than 100 case types." });
    }
    if (args.documentTypes !== undefined && args.documentTypes.length > 100) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot have more than 100 document types." });
    }
    if (args.appointmentTypes !== undefined && args.appointmentTypes.length > 100) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot have more than 100 appointment types." });
    }
    if (args.customRoles !== undefined && args.customRoles.length > 50) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot have more than 50 custom roles." });
    }
    if (args.customRoles !== undefined) {
      for (const r of args.customRoles) {
        if (r.name.trim().length === 0 || r.name.length > 100) {
          throw new ConvexError({ code: "BAD_REQUEST", message: "Role name must be between 1 and 100 characters." });
        }
      }
    }
    if (args.taxRate !== undefined && (args.taxRate < 0 || args.taxRate > 100)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Tax rate must be between 0 and 100." });
    }
    if (args.defaultCurrency !== undefined && (args.defaultCurrency.length < 3 || args.defaultCurrency.length > 10)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Currency code must be 3–10 characters." });
    }
    if (args.timezone !== undefined && args.timezone.length > 100) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Timezone identifier must be ≤100 characters." });
    }
    if (args.officeHours !== undefined) {
      for (const w of args.officeHours) {
        if (w.dayOfWeek < 0 || w.dayOfWeek > 6)
          throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid day of week in office hours." });
        if (w.startHour < 0 || w.startHour > 23)
          throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid start hour in office hours." });
        if (w.endHour < 1 || w.endHour > 24 || w.endHour <= w.startHour)
          throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid end hour in office hours." });
      }
    }

    // Enforce non-removable built-in roles and cascade-reassign members when a custom role is deleted.
    if (args.customRoles !== undefined) {
      const BUILT_IN_IDS = ["case_manager", "staff", "accountant"] as const;
      const newRoleIds = new Set(args.customRoles.map((r) => r.id));

      // Block removal of built-in roles and enforce their canonical names
      for (const id of BUILT_IN_IDS) {
        if (!newRoleIds.has(id)) {
          throw new ConvexError({
            code: "VALIDATION",
            message: "The Case Manager, Staff, and Accountant roles cannot be removed.",
          });
        }
      }
      // Overwrite built-in role names with canonical values regardless of submission
      args = {
        ...args,
        customRoles: args.customRoles.map((r) =>
          r.id === "case_manager" ? { ...r, name: "Case Manager", permissionLevel: "case_manager" as const }
          : r.id === "staff"        ? { ...r, name: "Staff",         permissionLevel: "staff"        as const }
          : r.id === "accountant"   ? { ...r, name: "Accountant",    permissionLevel: "accountant"   as const }
          : r
        ),
      };

      // Cascade-reassign members whose role is being deleted
      const currentRoles = settings.customRoles ?? DEFAULT_CUSTOM_ROLES;
      const removedCustomRoles = currentRoles.filter(
        (r) => !(BUILT_IN_IDS as readonly string[]).includes(r.id) && !newRoleIds.has(r.id)
      );

      if (removedCustomRoles.length > 0) {
        const orgUsers = await ctx.db
          .query("users")
          .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
          .collect();

        await Promise.all(
          removedCustomRoles.flatMap((removed) => {
            const fallbackRoleId = removed.permissionLevel; // built-in id matching the permission level
            return orgUsers
              .filter((u) => u.roleId === removed.id)
              .map((u) => ctx.db.patch(u._id, { roleId: fallbackRoleId }));
          })
        );
      }
    }

    await ctx.db.patch(settings._id, args);
  },
});

/** Admin-only: update client portal settings (slug + enabled flag).
 *  The slug is auto-generated from the org name and non-editable by admins.
 *  If the base slug is already taken by another org, a numeric suffix is
 *  appended (e.g. smithlawfirm → smithlawfirm2) to guarantee uniqueness. */
export const updatePortalSettings = authenticatedMutation({
  args: {
    portalSlug: v.optional(v.string()),
    portalEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }

    if (args.portalSlug !== undefined) {
      const baseSlug = args.portalSlug.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (baseSlug.length < 1) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Organisation name cannot produce a valid portal slug." });
      }

      // Auto-resolve uniqueness: try baseSlug, then baseSlug2, baseSlug3, …
      let finalSlug = baseSlug;
      let counter = 2;
      while (true) {
        const conflict = await ctx.db
          .query("organisations")
          .withIndex("by_portal_slug", (q) => q.eq("portalSlug", finalSlug))
          .unique();
        if (!conflict || conflict._id === ctx.user.organisationId) break;
        finalSlug = `${baseSlug}${counter}`;
        counter++;
      }

      await ctx.db.patch(ctx.user.organisationId, { portalSlug: finalSlug, portalEnabled: args.portalEnabled });
      return { portalSlug: finalSlug };
    } else {
      await ctx.db.patch(ctx.user.organisationId, { portalEnabled: args.portalEnabled });
      return {};
    }
  },
});

/**
 * Internal: raw DB update for Stripe settings.
 * Called by the saveStripeSettings action (which handles auth + encryption).
 */
export const updateStripeSettingsInternal = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    stripeEnabled: v.boolean(),
    stripePublishableKey: v.optional(v.string()),
    stripeSecretKey: v.optional(v.string()),
    stripeWebhookSecret: v.optional(v.string()),
    stripeSecretKeyEnc: v.optional(v.string()),
    stripeWebhookSecretEnc: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organisationId, ...rawFields } = args;
    const settings = await ctx.db
      .query("organisationSettings")
      .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
      .unique();
    if (!settings) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Organisation settings not found." });
    }
    // Strip undefined values — db.patch treats undefined as "delete field"
    const fields = Object.fromEntries(
      Object.entries(rawFields).filter(([, v]) => v !== undefined)
    ) as typeof rawFields;
    await ctx.db.patch(settings._id, fields);
  },
});

/**
 * Internal: permanently cascade-deletes all Convex data for an organisation.
 * Called by purgeExpiredOrgs after Clerk users have been removed.
 */
export const permanentDeleteOrg = internalMutation({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const { organisationId } = args;

    const deleteAll = async (table: Parameters<typeof ctx.db.query>[0], indexName: string) => {
      const rows = await (ctx.db.query(table) as any).withIndex(indexName, (q: any) =>
        q.eq("organisationId", organisationId)
      ).collect();
      await Promise.all(rows.map((r: { _id: Parameters<typeof ctx.db.delete>[0] }) => ctx.db.delete(r._id)));
    };

    await deleteAll("users", "by_org");
    await deleteAll("cases", "by_org");
    await deleteAll("tasks", "by_org");
    await deleteAll("documents", "by_org");
    await deleteAll("clients", "by_org");
    await deleteAll("comments", "by_org");
    await deleteAll("invoices", "by_org");
    await deleteAll("invitations", "by_org");
    await deleteAll("appointments", "by_org");
    await deleteAll("notifications", "by_org");
    await deleteAll("organisationSettings", "by_org");
    await deleteAll("invoiceCounters", "by_org");
    await deleteAll("paymentLinks", "by_org");
    await deleteAll("payments", "by_org");
    await deleteAll("bankAccounts", "by_org");
    await deleteAll("disputes", "by_org");
    await deleteAll("webhookLogs", "by_org");
    await deleteAll("appointmentAvailability", "by_org");
    await deleteAll("staffAvailability", "by_org");
    await deleteAll("staffBlackoutDates", "by_org");

    await ctx.db.delete(organisationId);
  },
});

/**
 * Soft-deletes the organisation, starting the 30-day grace period.
 * Admin only. Requires the caller to pass the exact confirmation string
 * "Delete {org name}" — verified server-side to prevent API exploitation.
 * Rate-limited to 3 attempts per hour to block brute-force name guessing.
 */
export const softDeleteOrg = authenticatedMutation({
  args: { confirmName: v.string() },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }

    // Rate limit: max 3 attempts per hour per org
    await checkRateLimit(ctx, `softDeleteOrg:${ctx.user.organisationId}`, 3, 3_600_000);

    const org = await ctx.db.get(ctx.user.organisationId);
    if (!org) throw new ConvexError({ code: "NOT_FOUND", message: "Organisation not found." });

    if (org.deletedAt) {
      throw new ConvexError({ code: "CONFLICT", message: "Organisation is already scheduled for deletion." });
    }

    // Server-side confirmation: typed string must match exactly
    const expected = `Delete ${org.name}`;
    if (args.confirmName !== expected) {
      throw new ConvexError({
        code: "CONFIRMATION_MISMATCH",
        message: `Confirmation text does not match. Type exactly: "${expected}"`,
      });
    }

    await ctx.db.patch(ctx.user.organisationId, { deletedAt: Date.now() });

    // Deactivate all staff except the calling admin so they can no longer
    // log in or access data during the grace period.
    // The admin stays active so they can still reactivate the org.
    const allUsers = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .collect();

    await Promise.all(
      allUsers
        .filter((u) => u._id !== ctx.user._id && u.status === "active")
        .map((u) => ctx.db.patch(u._id, { status: "inactive" }))
    );
  },
});

/** Admin: upsert appointment pricing for a given type. */
export const upsertAppointmentPricing = authenticatedMutation({
  args: {
    appointmentType: v.string(),
    priceInCents: v.number(),
    currency: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    if (args.priceInCents < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Price cannot be negative." });
    }
    const existing = await ctx.db
      .query("appointmentPricing")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
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
      await ctx.db.insert("appointmentPricing", {
        organisationId: ctx.user.organisationId,
        ...args,
      });
    }
  },
});

/** Admin: delete appointment pricing by ID. */
export const deleteAppointmentPricing = authenticatedMutation({
  args: { id: v.id("appointmentPricing") },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    const record = await ctx.db.get(args.id);
    if (!record || record.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pricing record not found." });
    }
    await ctx.db.delete(args.id);
  },
});

/** Admin: toggle portal access for a single client. */
export const setClientPortalEnabled = authenticatedMutation({
  args: { clientId: v.id("clients"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    const client = await ctx.db.get(args.clientId);
    if (!client || client.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    await ctx.db.patch(args.clientId, { portalEnabled: args.enabled });
  },
});

/**
 * Clears the deletedAt timestamp, restoring the organisation.
 * Re-activates all staff members that were deactivated by softDeleteOrg.
 * Admin only.
 */
export const reactivateOrg = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    const org = await ctx.db.get(ctx.user.organisationId);
    if (!org) throw new ConvexError({ code: "NOT_FOUND", message: "Organisation not found." });
    if (!org.deletedAt) {
      throw new ConvexError({ code: "CONFLICT", message: "Organisation is not scheduled for deletion." });
    }

    await ctx.db.patch(ctx.user.organisationId, { deletedAt: undefined });

    // Restore all inactive staff (those deactivated by softDeleteOrg)
    const allUsers = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .collect();

    await Promise.all(
      allUsers
        .filter((u) => u._id !== ctx.user._id && u.status === "inactive")
        .map((u) => ctx.db.patch(u._id, { status: "active" }))
    );
  },
});
