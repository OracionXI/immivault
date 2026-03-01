import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/** Step 1 of upload: returns a one-time URL the client uploads the file to directly. */
export const generateUploadUrl = authenticatedMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Step 2 of upload: called after the file has been uploaded to storage. */
export const create = authenticatedMutation({
  args: {
    clientId: v.id("clients"),
    caseId: v.optional(v.id("cases")),
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
    status: v.union(
      v.literal("Pending"),
      v.literal("Verified"),
      v.literal("Expired"),
      v.literal("Rejected")
    ),
    expiryDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      ...args,
      organisationId: ctx.user.organisationId,
      uploadedBy: ctx.user._id,
    });
  },
});

export const updateStatus = authenticatedMutation({
  args: {
    id: v.id("documents"),
    status: v.union(
      v.literal("Pending"),
      v.literal("Verified"),
      v.literal("Expired"),
      v.literal("Rejected")
    ),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

/** Deletes the document record and the underlying storage file. */
export const remove = authenticatedMutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(args.id);
  },
});
