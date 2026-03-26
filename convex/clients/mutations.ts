import { authenticatedMutation } from "../lib/auth";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAdmin } from "../lib/rbac";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

async function nextInvoiceNumber(ctx: MutationCtx, organisationId: Id<"organisations">): Promise<string> {
  const all = await ctx.db
    .query("invoices")
    .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
    .collect();
  return `INV-${String(all.length + 1).padStart(4, "0")}`;
}

function buildCaseNumber(): string {
  const date = new Date();
  const ymd =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `IMV-${ymd}-${rand}`;
}

/** Admin-only: create a new client and auto-create an unassigned case. */
export const create = authenticatedMutation({
  args: {
    prefix: v.optional(v.string()),
    firstName: v.string(),
    middleName: v.optional(v.string()),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    mobilePhone: v.optional(v.string()),
    nationality: v.optional(v.string()),
    countryOfBirth: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    maritalStatus: v.optional(v.string()),
    passportNumber: v.optional(v.string()),
    languagePreference: v.optional(v.string()),
    address: v.optional(v.string()),
    referralSource: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("Active"),
      v.literal("Inactive"),
      v.literal("Archived")
    ),
    assignedTo: v.optional(v.id("users")),
    contractAmount: v.optional(v.number()), // in cents
    portalEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);

    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    if (firstName.length === 0 || firstName.length > 100) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "First name must be between 1 and 100 characters." });
    }
    if (lastName.length === 0 || lastName.length > 100) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Last name must be between 1 and 100 characters." });
    }
    const emailNormalized = args.email.trim().toLowerCase();
    if (emailNormalized.length === 0 || emailNormalized.length > 254) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Email address is invalid." });
    }
    const emailDuplicate = await ctx.db
      .query("clients")
      .withIndex("by_org_and_email", (q) =>
        q.eq("organisationId", ctx.user.organisationId).eq("email", emailNormalized)
      )
      .first();
    if (emailDuplicate) {
      throw new ConvexError({ code: "CONFLICT", message: "A client with this email address already exists in your organisation." });
    }
    if (args.phone !== undefined && args.phone.length > 50) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Phone number cannot exceed 50 characters." });
    }
    if (args.nationality !== undefined && args.nationality.length > 100) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nationality cannot exceed 100 characters." });
    }
    if (args.address !== undefined && args.address.length > 500) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Address cannot exceed 500 characters." });
    }
    if (args.contractAmount !== undefined && args.contractAmount < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Contract amount cannot be negative." });
    }

    const { portalEnabled, ...clientFields } = args;

    const clientId = await ctx.db.insert("clients", {
      ...clientFields,
      email: emailNormalized,
      portalEnabled: portalEnabled ?? false,
      organisationId: ctx.user.organisationId,
    });

    // Auto-create an unassigned case for the new client
    await ctx.db.insert("cases", {
      organisationId: ctx.user.organisationId,
      caseNumber: buildCaseNumber(),
      title: `${args.firstName} ${args.lastName} — New Case`,
      clientId,
      visaType: "None",
      status: "To Do",
      priority: "Medium",
      // assignedTo intentionally omitted — unassigned by default
    });

    // Auto-create a contract Draft invoice when a contract amount is provided
    if (args.contractAmount && args.contractAmount > 0) {
      const total = args.contractAmount / 100; // cents → dollars
      const invoiceNumber = await nextInvoiceNumber(ctx, ctx.user.organisationId);
      await ctx.db.insert("invoices", {
        organisationId: ctx.user.organisationId,
        clientId,
        status: "Draft",
        taxRate: 0,
        subtotal: total,
        taxAmount: 0,
        total,
        invoiceNumber,
        dueDate: new Date(9999, 11, 31).getTime(), // far-future — never auto-overdue
        createdBy: ctx.user._id,
        isContractDraft: true,
        paidAmount: 0,
      });
    }

    // If portal access is enabled at creation, send invite (if org portal is configured)
    if (portalEnabled) {
      const org = await ctx.db.get(ctx.user.organisationId);
      if (org?.portalEnabled && org?.portalSlug) {
        await ctx.scheduler.runAfter(0, internal.portal.auth.sendInvite, {
          clientId,
          organisationId: ctx.user.organisationId,
        });
      }
    }

    return clientId;
  },
});

/** Admin-only: update client details.
 *  Inactive:    cascades tasks → hidden (cases stay, just filtered from views).
 *  Reactivate:  cascades tasks → visible again (status/assignedTo preserved).
 *  Archiving:   cascades cases → Archive, tasks → hidden.
 *  Unarchiving: cascades cases → To Do, tasks → visible + To Do + unassigned. */
export const update = authenticatedMutation({
  args: {
    id: v.id("clients"),
    prefix: v.optional(v.string()),
    firstName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    mobilePhone: v.optional(v.string()),
    nationality: v.optional(v.string()),
    countryOfBirth: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    maritalStatus: v.optional(v.string()),
    passportNumber: v.optional(v.string()),
    languagePreference: v.optional(v.string()),
    address: v.optional(v.string()),
    referralSource: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("Active"),
        v.literal("Inactive"),
        v.literal("Archived")
      )
    ),
    assignedTo: v.optional(v.id("users")),
    contractAmount: v.optional(v.number()), // in cents
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const { id, contractAmount, ...fields } = args;

    if (fields.firstName !== undefined) {
      const fn = fields.firstName.trim();
      if (fn.length === 0 || fn.length > 100) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "First name must be between 1 and 100 characters." });
      }
    }
    if (fields.lastName !== undefined) {
      const ln = fields.lastName.trim();
      if (ln.length === 0 || ln.length > 100) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Last name must be between 1 and 100 characters." });
      }
    }
    if (fields.email !== undefined) {
      const emailNorm = fields.email.trim().toLowerCase();
      if (emailNorm.length === 0 || emailNorm.length > 254) {
        throw new ConvexError({ code: "BAD_REQUEST", message: "Email address is invalid." });
      }
      const emailDuplicate = await ctx.db
        .query("clients")
        .withIndex("by_org_and_email", (q) =>
          q.eq("organisationId", ctx.user.organisationId).eq("email", emailNorm)
        )
        .first();
      if (emailDuplicate && emailDuplicate._id !== id) {
        throw new ConvexError({ code: "CONFLICT", message: "A client with this email address already exists in your organisation." });
      }
      fields.email = emailNorm;
    }
    if (fields.phone !== undefined && fields.phone.length > 50) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Phone number cannot exceed 50 characters." });
    }
    if (fields.nationality !== undefined && fields.nationality.length > 100) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nationality cannot exceed 100 characters." });
    }
    if (fields.address !== undefined && fields.address.length > 500) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Address cannot exceed 500 characters." });
    }
    if (contractAmount !== undefined && contractAmount < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Contract amount cannot be negative." });
    }

    const client = await ctx.db.get(id);
    if (!client || client.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }

    const wasArchived = client.status === "Archived";
    const wasInactive = client.status === "Inactive";
    const isArchiving = args.status === "Archived";
    const isInactivating = args.status === "Inactive" && client.status !== "Inactive";
    const isReactivating = wasInactive && args.status === "Active";
    const isUnarchiving = wasArchived && args.status !== undefined && args.status !== "Archived";

    await ctx.db.patch(id, { ...fields, contractAmount });

    // Upsert the contract Draft invoice when contractAmount changes
    if (contractAmount !== undefined) {
      const existingDraft = await ctx.db
        .query("invoices")
        .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
        .filter((q) =>
          q.and(
            q.eq(q.field("clientId"), id),
            q.eq(q.field("isContractDraft"), true)
          )
        )
        .first();

      if (contractAmount > 0) {
        const total = contractAmount / 100;
        if (existingDraft) {
          await ctx.db.patch(existingDraft._id, { total, subtotal: total });
        } else {
          const invoiceNumber = await nextInvoiceNumber(ctx, ctx.user.organisationId);
          await ctx.db.insert("invoices", {
            organisationId: ctx.user.organisationId,
            clientId: id,
            status: "Draft",
            taxRate: 0,
            subtotal: total,
            taxAmount: 0,
            total,
            invoiceNumber,
            dueDate: new Date(9999, 11, 31).getTime(),
            createdBy: ctx.user._id,
            isContractDraft: true,
            paidAmount: 0,
          });
        }
      } else if (contractAmount === 0 && existingDraft && !(existingDraft.paidAmount && existingDraft.paidAmount > 0)) {
        await ctx.db.delete(existingDraft._id);
      }
    }

    const linkedCases = await ctx.db
      .query("cases")
      .withIndex("by_client", (q) => q.eq("clientId", id))
      .collect();

    if (isArchiving) {
      // Cascade archive: cases → Archive, tasks → hidden
      for (const c of linkedCases) {
        await ctx.db.patch(c._id, { status: "Archive" });
        const caseTasks = await ctx.db
          .query("tasks")
          .withIndex("by_case", (q) => q.eq("caseId", c._id))
          .collect();
        for (const t of caseTasks) {
          await ctx.db.patch(t._id, { hidden: true });
        }
      }
    } else if (isUnarchiving) {
      // Cascade unarchive: cases → To Do, tasks → visible + To Do + unassigned
      for (const c of linkedCases) {
        await ctx.db.patch(c._id, { status: "To Do" });
        const caseTasks = await ctx.db
          .query("tasks")
          .withIndex("by_case", (q) => q.eq("caseId", c._id))
          .collect();
        for (const t of caseTasks) {
          await ctx.db.patch(t._id, {
            hidden: false,
            status: "To Do",
            assignedTo: undefined,
            completedAt: undefined,
          });
        }
      }
    } else if (isInactivating) {
      // Cascade inactive: tasks → hidden (cases stay in DB, filtered at query time)
      for (const c of linkedCases) {
        const caseTasks = await ctx.db
          .query("tasks")
          .withIndex("by_case", (q) => q.eq("caseId", c._id))
          .collect();
        for (const t of caseTasks) {
          await ctx.db.patch(t._id, { hidden: true });
        }
      }
    } else if (isReactivating) {
      // Cascade reactivate: tasks → visible (preserve their status and assignedTo)
      for (const c of linkedCases) {
        const caseTasks = await ctx.db
          .query("tasks")
          .withIndex("by_case", (q) => q.eq("caseId", c._id))
          .collect();
        for (const t of caseTasks) {
          await ctx.db.patch(t._id, { hidden: false });
        }
      }
    }
  },
});

/** Admin-only: permanently delete a client along with all linked cases and tasks. */
export const remove = authenticatedMutation({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const client = await ctx.db.get(args.id);
    if (!client || client.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }

    // Delete all documents (+ storage files) linked to this client
    const linkedDocs = await ctx.db
      .query("documents")
      .withIndex("by_client", (q) => q.eq("clientId", args.id))
      .collect();
    for (const doc of linkedDocs) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(doc._id);
    }

    // Delete all tasks under every linked case, then delete each case
    const linkedCases = await ctx.db
      .query("cases")
      .withIndex("by_client", (q) => q.eq("clientId", args.id))
      .collect();

    for (const c of linkedCases) {
      const caseTasks = await ctx.db
        .query("tasks")
        .withIndex("by_case", (q) => q.eq("caseId", c._id))
        .collect();
      for (const t of caseTasks) {
        const taskComments = await ctx.db
          .query("comments")
          .withIndex("by_entity", (q) => q.eq("entityType", "task").eq("entityId", t._id))
          .collect();
        for (const cm of taskComments) await ctx.db.delete(cm._id);
        await ctx.db.delete(t._id);
      }
      const caseComments = await ctx.db
        .query("comments")
        .withIndex("by_entity", (q) => q.eq("entityType", "case").eq("entityId", c._id))
        .collect();
      for (const cm of caseComments) await ctx.db.delete(cm._id);
      await ctx.db.delete(c._id);
    }

    await ctx.db.delete(args.id);
  },
});

/** Admin-only: resend a portal invite (magic link) to a client. */
export const resendPortalInvite = action({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated." });
    }
    const caller = await ctx.runQuery(internal.users.queries.getByToken, {
      token: identity.tokenIdentifier,
    });
    if (!caller || caller.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin privileges required." });
    }
    // Verify the client belongs to the caller's org — prevents cross-org invite spam
    const client = await ctx.runQuery(internal.clients.queries.getForAction, {
      id: args.clientId,
    });
    if (!client || client.organisationId !== caller.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }
    await ctx.runAction(internal.portal.auth.sendInvite, {
      clientId: args.clientId,
      organisationId: caller.organisationId,
    });
  },
});
