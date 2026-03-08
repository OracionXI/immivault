import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getVisibleCaseIds } from "../lib/visibility";

/**
 * Visible documents scoped by role:
 *   admin        → all documents in org
 *   case_manager → documents under clients linked to their assigned cases
 *   staff        → documents under clients linked to cases containing their assigned tasks
 */
export const list = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const { role, _id: userId, organisationId } = ctx.user;

    if (role === "admin") {
      return await ctx.db
        .query("documents")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .order("desc")
        .collect();
    }

    const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
    const all = await ctx.db
      .query("documents")
      .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
      .collect();
    return all.filter((d) => !d.caseId || visibleCaseIds.has(d.caseId));
  },
});

/**
 * Documents with clientName + caseName pre-joined server-side.
 * Replaces the 3-query pattern (documents + clients + cases) on the Documents page.
 * Non-admin path uses per-case indexed lookups — no full org-wide scan.
 */
export const listEnriched = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const { role, _id: userId, organisationId } = ctx.user;

    let docs: any[];

    if (role === "admin") {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .order("desc")
        .collect();
    } else {
      const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
      // Indexed per-case lookup — no full table scan
      const perCase = await Promise.all(
        [...visibleCaseIds].map((caseId) =>
          ctx.db
            .query("documents")
            .withIndex("by_case", (q: any) => q.eq("caseId", caseId))
            .collect()
        )
      );
      docs = perCase.flat();
    }

    // Batch-fetch unique clients and cases — no duplicate round-trips
    const uniqueClientIds = [...new Set(docs.map((d) => d.clientId as string))];
    const uniqueCaseIds = [...new Set(docs.filter((d) => d.caseId).map((d) => d.caseId as string))];

    const [clientRecords, caseRecords] = await Promise.all([
      Promise.all(uniqueClientIds.map((id) => ctx.db.get(id as any))),
      Promise.all(uniqueCaseIds.map((id) => ctx.db.get(id as any))),
    ]);

    const clientMap = new Map(
      clientRecords.filter(Boolean).map((c: any) => [c._id, `${c.firstName} ${c.lastName}`])
    );
    const caseMap = new Map(
      caseRecords.filter(Boolean).map((c: any) => [c._id, c.title as string])
    );

    return docs.map((d) => ({
      ...d,
      clientName: (clientMap.get(d.clientId) ?? "—") as string,
      caseName: (d.caseId ? (caseMap.get(d.caseId) ?? "—") : "—") as string,
    }));
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

/** Internal: get a document by ID. Used by onDocumentUploaded notification action. */
export const getById = internalQuery({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Returns a short-lived signed URL for viewing/downloading a document. */
export const getViewUrl = authenticatedQuery({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Document not found." });
    }
    return await ctx.storage.getUrl(doc.storageId);
  },
});
