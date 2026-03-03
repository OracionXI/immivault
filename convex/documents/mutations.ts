import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAtLeastCaseManager } from "../lib/rbac";

/** Step 1 of upload: returns a one-time URL the client uploads the file to directly. */
export const generateUploadUrl = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    requireAtLeastCaseManager(ctx);
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
    type: v.union(
      v.literal("Identity"),
      v.literal("Employment"),
      v.literal("Immigration"),
      v.literal("Education"),
      v.literal("Financial"),
      v.literal("Supporting")
    ),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    requireAtLeastCaseManager(ctx);

    const c = await ctx.db.get(args.caseId);
    if (!c || c.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }

    // Case managers can only add docs to their assigned cases
    if (ctx.user.role === "case_manager" && c.assignedTo !== ctx.user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can only add documents to your own cases." });
    }

    return await ctx.db.insert("documents", {
      ...args,
      clientId: c.clientId,
      status: "Verified",
      organisationId: ctx.user.organisationId,
      uploadedBy: ctx.user._id,
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
