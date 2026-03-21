import { authenticatedMutation } from "../lib/auth";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAtLeastCaseManager } from "../lib/rbac";

const MAX_DOCUMENT_NAME_LENGTH = 255;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

/** Step 1 of upload: returns a one-time URL the client uploads the file to directly. */
export const generateUploadUrl = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Step 2 of upload: called after the file has been uploaded to storage.
 *  caseId is required — clientId is derived from the case server-side.
 *  Documents are always Verified on creation. */
export const create = authenticatedMutation({
  args: {
    caseId: v.id("cases"),
    name: v.string(),
    type: v.optional(v.string()),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedName = args.name.trim();
    if (trimmedName.length === 0 || trimmedName.length > MAX_DOCUMENT_NAME_LENGTH) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Document name must be between 1 and ${MAX_DOCUMENT_NAME_LENGTH} characters.` });
    }
    if (!ALLOWED_MIME_TYPES.has(args.mimeType)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "File type not allowed." });
    }

    const c = await ctx.db.get(args.caseId);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }

    // Case managers can only add docs to their assigned cases
    if (ctx.user.role === "case_manager" && c.assignedTo !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can only add documents to your own cases." });
    }

    // Staff can only add docs to cases where they have an assigned task
    if (ctx.user.role === "staff") {
      const staffTask = await ctx.db
        .query("tasks")
        .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
        .filter((q) =>
          q.and(
            q.eq(q.field("caseId"), args.caseId),
            q.eq(q.field("assignedTo"), ctx.user._id)
          )
        )
        .first();
      if (!staffTask) {
        throw new ConvexError({ code: "FORBIDDEN", message: "You can only add documents to cases where you have assigned tasks." });
      }
    }

    const id = await ctx.db.insert("documents", {
      ...args,
      name: trimmedName,
      clientId: c.clientId,
      status: "Verified",
      organisationId: ctx.user.organisationId,
      uploadedBy: ctx.user._id,
    });

    // Notify the case assignee that a new document was uploaded
    await ctx.scheduler.runAfter(0, internal.notifications.actions.onDocumentUploaded, {
      documentId: id,
      uploaderId: ctx.user._id,
    });

    return id;
  },
});

/** Admin or Case Manager: update document metadata (name, type, case).
 *  If caseId changes, clientId is re-derived from the new case. */
export const update = authenticatedMutation({
  args: {
    id: v.id("documents"),
    name: v.string(),
    type: v.optional(v.string()),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }

    const newCase = await ctx.db.get(args.caseId);
    if (!newCase || newCase.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }

    // Case managers can only edit docs on their own cases (both old and new)
    if (ctx.user.role === "case_manager") {
      if (doc.caseId) {
        const oldCase = await ctx.db.get(doc.caseId);
        if (!oldCase || oldCase.assignedTo !== ctx.user._id) {
          throw new ConvexError({ code: "FORBIDDEN", message: "You can only edit documents from your own cases." });
        }
      }
      if (newCase.assignedTo !== ctx.user._id) {
        throw new ConvexError({ code: "FORBIDDEN", message: "You can only move documents to your own cases." });
      }
    }

    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      type: args.type,
      caseId: args.caseId,
      clientId: newCase.clientId,
    });
  },
});

/** Admin or Case Manager: delete a document and its storage file. */
export const remove = authenticatedMutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }

    // Case managers can only remove docs from their cases
    if (ctx.user.role === "case_manager" && doc.caseId) {
      const c = await ctx.db.get(doc.caseId);
      if (!c || c.assignedTo !== ctx.user._id) {
        throw new ConvexError({ code: "FORBIDDEN", message: "You can only remove documents from your own cases." });
      }
    }

    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(args.id);
  },
});
