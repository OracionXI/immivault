import { authenticatedQuery } from "../lib/auth";
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getVisibleCaseIds, getVisibleClientIds } from "../lib/visibility";

/** Active (non-deleted, confirmed) documents only. */
function isActive(doc: { uploadStatus: string; deletedAt?: number }): boolean {
  return doc.uploadStatus === "active" && doc.deletedAt == null;
}

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
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .order("desc")
        .collect();
      return docs.filter(isActive);
    }

    const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
    const all = await ctx.db
      .query("documents")
      .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
      .collect();
    return all.filter((d) => isActive(d) && (!d.caseId || visibleCaseIds.has(d.caseId)));
  },
});

/**
 * Documents with clientName + caseName pre-joined server-side.
 */
export const listEnriched = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    const { role, _id: userId, organisationId } = ctx.user;

    let docs: any[];

    if (role === "admin") {
      const all = await ctx.db
        .query("documents")
        .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
        .order("desc")
        .collect();
      docs = all.filter(isActive);
    } else {
      const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
      const perCase = await Promise.all(
        [...visibleCaseIds].map((caseId) =>
          ctx.db
            .query("documents")
            .withIndex("by_case", (q: any) => q.eq("caseId", caseId))
            .collect()
        )
      );
      docs = perCase.flat().filter(isActive);
    }

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

/** Documents for a specific client. Enforces org isolation + role-based visibility. */
export const listByClient = authenticatedQuery({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const { role, _id: userId, organisationId } = ctx.user;

    const client = await ctx.db.get(args.clientId);
    if (!client || client.organisationId !== organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }

    if (role !== "admin") {
      const visibleClientIds = await getVisibleClientIds(ctx.db, role, userId, organisationId);
      if (!visibleClientIds.has(args.clientId)) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
      }
    }

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    return docs.filter(isActive);
  },
});

/** Documents for a specific case. Enforces org isolation + role-based visibility. */
export const listByCase = authenticatedQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const { role, _id: userId, organisationId } = ctx.user;

    const c = await ctx.db.get(args.caseId);
    if (!c || c.organisationId !== organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
    }

    if (role !== "admin") {
      const visibleCaseIds = await getVisibleCaseIds(ctx.db, role, userId, organisationId);
      if (!visibleCaseIds.has(args.caseId)) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Case not found." });
      }
    }

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    return docs.filter(isActive);
  },
});

/** Internal: get a document by ID. Used by actions and notification handlers. */
export const getById = internalQuery({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Internal: list documents soft-deleted before a given timestamp. Capped by limit. */
export const listExpiredDeleted = internalQuery({
  args: {
    beforeMs: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_deleted_at", (q) =>
        q.gt("deletedAt", 0).lt("deletedAt", args.beforeMs)
      )
      .take(args.limit);
  },
});
