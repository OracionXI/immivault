import { authenticatedQuery } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/** All documents in the org. */
export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_org", (q) => q.eq("organisationId", ctx.user.organisationId))
      .order("desc")
      .collect();
  },
});

/** Documents for a specific client. */
export const listByClient = authenticatedQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
  },
});

/** Documents for a specific case. */
export const listByCase = authenticatedQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
  },
});

/** Returns a short-lived signed download URL for a document. */
export const getDownloadUrl = authenticatedQuery({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }
    return await ctx.storage.getUrl(doc.storageId);
  },
});
