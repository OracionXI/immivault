import { authenticatedMutation, authenticatedMutation as _am } from "../lib/auth";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAtLeastCaseManager } from "../lib/rbac";
import { checkRateLimit } from "../lib/rateLimit";

// ── Internal helpers used by actions ─────────────────────────────────────────

/** Rate-limit check for uploads (20/hr per user). Called from requestUpload action. */
export const checkUploadRateLimit = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await checkRateLimit(ctx, `doc-upload:${args.userId}`, 20, 3_600_000);
  },
});

/** Rate-limit check for view URL generation (100/hr per user). */
export const checkViewRateLimit = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await checkRateLimit(ctx, `doc-view:${args.userId}`, 100, 3_600_000);
  },
});

/** Insert a pending document record. Returns the new document ID. */
export const insertPending = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    name: v.string(),
    type: v.optional(v.string()),
    mimeType: v.string(),
    fileSize: v.number(),
    visibility: v.union(v.literal("internal"), v.literal("client")),
    uploadedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      ...args,
      s3Key: "",
      uploadStatus: "pending",
      status: "Verified",
    });
  },
});

/** Patch the s3Key onto a pending document once the key is known. */
export const patchS3Key = internalMutation({
  args: { id: v.id("documents"), s3Key: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { s3Key: args.s3Key });
  },
});

/** Hard-delete a document record (used by purge cron after S3 object is gone). */
export const hardDelete = internalMutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ── Authenticated mutations ───────────────────────────────────────────────────

/**
 * Step 3 of the upload flow.
 * Called after the browser PUT to S3 succeeds. Marks the document "active"
 * and fires the document_uploaded notification.
 */
export const confirmUpload = authenticatedMutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }
    if (doc.uploadStatus !== "pending") {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Document already confirmed." });
    }

    await ctx.db.patch(args.id, { uploadStatus: "active" });

    await ctx.scheduler.runAfter(0, internal.notifications.actions.onDocumentUploaded, {
      documentId: args.id,
      uploaderId: ctx.user._id,
    });
  },
});

/** Admin or Case Manager: update document metadata (name, type, case, visibility). */
export const update = authenticatedMutation({
  args: {
    id: v.id("documents"),
    name: v.string(),
    type: v.optional(v.string()),
    caseId: v.id("cases"),
    visibility: v.optional(v.union(v.literal("internal"), v.literal("client"))),
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
      ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
    });
  },
});

/** Admin or Case Manager: soft-delete a document (sets deletedAt). S3 purge cron cleans up after 30 days. */
export const remove = authenticatedMutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }

    if (ctx.user.role === "case_manager" && doc.caseId) {
      const c = await ctx.db.get(doc.caseId);
      if (!c || c.assignedTo !== ctx.user._id) {
        throw new ConvexError({ code: "FORBIDDEN", message: "You can only remove documents from your own cases." });
      }
    }

    await ctx.db.patch(args.id, { deletedAt: Date.now() });
  },
});
