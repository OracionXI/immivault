"use node";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v, ConvexError } from "convex/values";
import { buildS3Key, presignPutUrl, presignGetUrl, deleteS3Object } from "../lib/s3";
import type { Id } from "../_generated/dataModel";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
]);

/** Sanitize filename: strip unsafe chars, spaces → hyphens, max 200 chars. */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._\-\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 200);
}

/** Resolve the authenticated Convex user from the JWT in ctx. Throws if unauthenticated. */
async function requireUser(ctx: { auth: { getUserIdentity: () => Promise<{ tokenIdentifier: string } | null> }; runQuery: Function }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated." });
  }
  const user = await ctx.runQuery(internal.users.queries.getByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) {
    throw new ConvexError({ code: "USER_NOT_FOUND", message: "User profile not found." });
  }
  if (user.status === "inactive" || user.status === "pending_onboarding") {
    throw new ConvexError({ code: "ACCOUNT_INACTIVE", message: "Your account is pending activation." });
  }
  return user;
}

/**
 * Step 1 of the S3 upload flow.
 * Validates the request, inserts a pending document record, then returns a
 * pre-signed S3 PUT URL valid for 5 minutes.
 *
 * Called by POST /api/documents/request-upload via ConvexHttpClient.
 */
export const requestUpload = action({
  args: {
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
    filename: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    visibility: v.union(v.literal("internal"), v.literal("client")),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // ── Validate MIME type ────────────────────────────────────────────────────
    if (!ALLOWED_MIME_TYPES.has(args.mimeType)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "File type not allowed." });
    }

    // ── Validate file size ────────────────────────────────────────────────────
    if (args.fileSize <= 0 || args.fileSize > MAX_FILE_SIZE_BYTES) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "File size must be between 1 byte and 20 MB." });
    }

    // ── Rate limit: 20 uploads per user per hour ──────────────────────────────
    await ctx.runMutation(internal.documents.mutations.checkUploadRateLimit, {
      userId: user._id,
    });

    // ── Sanitize filename ─────────────────────────────────────────────────────
    const sanitizedName = sanitizeFilename(args.filename);
    if (sanitizedName.length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid filename." });
    }

    // ── Insert pending document record ────────────────────────────────────────
    const documentId: Id<"documents"> = await ctx.runMutation(
      internal.documents.mutations.insertPending,
      {
        organisationId: user.organisationId,
        clientId: args.clientId,
        caseId: args.caseId,
        name: sanitizedName,
        type: args.type,
        mimeType: args.mimeType,
        fileSize: args.fileSize,
        visibility: args.visibility,
        uploadedBy: user._id,
      }
    );

    // ── Build S3 key and patch the record ─────────────────────────────────────
    const s3Key = buildS3Key(user.organisationId, documentId);
    await ctx.runMutation(internal.documents.mutations.patchS3Key, {
      id: documentId,
      s3Key,
    });

    // ── Generate pre-signed PUT URL ───────────────────────────────────────────
    const uploadUrl = await presignPutUrl(s3Key, args.mimeType, args.fileSize);

    return { uploadUrl, documentId };
  },
});

/**
 * Returns a pre-signed S3 GET URL (15 min) for viewing a document.
 * Enforces org isolation, upload status, soft-delete, and role visibility.
 *
 * Called by GET /api/documents/view-url via ConvexHttpClient.
 */
export const getViewUrl = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const doc = await ctx.runQuery(internal.documents.queries.getById, {
      id: args.documentId,
    });

    if (!doc || doc.organisationId !== user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }

    if (doc.uploadStatus !== "active" || doc.deletedAt != null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }

    // ── Rate limit: 100 views per user per hour ───────────────────────────────
    await ctx.runMutation(internal.documents.mutations.checkViewRateLimit, {
      userId: user._id,
    });

    const url = await presignGetUrl(doc.s3Key);
    return { url };
  },
});

/**
 * Internal: portal document view URL (enforces visibility="client").
 * Called from the /portal/document-url HTTP action.
 */
export const getPortalViewUrl = internalAction({
  args: {
    documentId: v.id("documents"),
    clientId: v.id("clients"),
    organisationId: v.id("organisations"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.runQuery(internal.documents.queries.getById, {
      id: args.documentId,
    });

    if (!doc || doc.organisationId !== args.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }
    if (doc.uploadStatus !== "active" || doc.deletedAt != null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }
    if (doc.visibility !== "client") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Document not found." });
    }

    // Rate limit keyed on clientId string
    await ctx.runMutation(internal.documents.mutations.checkViewRateLimit, {
      userId: args.clientId,
    });

    const url = await presignGetUrl(doc.s3Key);
    return { url };
  },
});

/**
 * Daily cron: permanently delete S3 objects and Convex records for
 * documents soft-deleted more than 30 days ago. Capped at 500 per run.
 */
export const purgeDeleted = internalAction({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const docs = await ctx.runQuery(internal.documents.queries.listExpiredDeleted, {
      beforeMs: thirtyDaysAgo,
      limit: 500,
    });

    let purged = 0;
    for (const doc of docs) {
      try {
        if (doc.s3Key) {
          await deleteS3Object(doc.s3Key);
        }
        await ctx.runMutation(internal.documents.mutations.hardDelete, {
          id: doc._id,
        });
        purged++;
      } catch {
        console.error(`Failed to purge document ${doc._id}:`, doc.s3Key);
      }
    }

    console.log(`purgeDeleted: purged ${purged} documents`);
  },
});
