import { authenticatedMutation } from "../lib/auth";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireAdmin } from "../lib/rbac";

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
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    nationality: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    address: v.optional(v.string()),
    status: v.union(
      v.literal("Active"),
      v.literal("Pending"),
      v.literal("Inactive"),
      v.literal("Archived")
    ),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);

    const clientId = await ctx.db.insert("clients", {
      ...args,
      organisationId: ctx.user.organisationId,
    });

    // Auto-create an unassigned case for the new client
    await ctx.db.insert("cases", {
      organisationId: ctx.user.organisationId,
      caseNumber: buildCaseNumber(),
      title: `${args.firstName} ${args.lastName} — New Case`,
      clientId,
      visaType: "TBD",
      status: "Pending",
      priority: "Medium",
      // assignedTo intentionally omitted — unassigned by default
    });

    return clientId;
  },
});

/** Admin-only: update client details.
 *  Archiving:   cascades cases → Archived, tasks → hidden.
 *  Unarchiving: cascades cases → Pending, tasks → visible, To Do, unassigned. */
export const update = authenticatedMutation({
  args: {
    id: v.id("clients"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    nationality: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),
    address: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("Active"),
        v.literal("Pending"),
        v.literal("Inactive"),
        v.literal("Archived")
      )
    ),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    requireAdmin(ctx);
    const { id, ...fields } = args;
    const client = await ctx.db.get(id);
    if (!client || client.organisationId !== ctx.user.organisationId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Client not found." });
    }

    const wasArchived = client.status === "Archived";
    const isArchiving = args.status === "Archived";
    const isUnarchiving = wasArchived && args.status !== undefined && args.status !== "Archived";

    await ctx.db.patch(id, fields);

    const linkedCases = await ctx.db
      .query("cases")
      .withIndex("by_client", (q) => q.eq("clientId", id))
      .collect();

    if (isArchiving) {
      // Cascade archive: cases → Archived, tasks → hidden
      for (const c of linkedCases) {
        await ctx.db.patch(c._id, { status: "Archived" });

        const caseTasks = await ctx.db
          .query("tasks")
          .withIndex("by_case", (q) => q.eq("caseId", c._id))
          .collect();
        for (const t of caseTasks) {
          await ctx.db.patch(t._id, { hidden: true });
        }
      }
    } else if (isUnarchiving) {
      // Cascade unarchive: cases → Pending, tasks → visible + To Do + unassigned
      for (const c of linkedCases) {
        await ctx.db.patch(c._id, { status: "Pending" });

        const caseTasks = await ctx.db
          .query("tasks")
          .withIndex("by_case", (q) => q.eq("caseId", c._id))
          .collect();
        for (const t of caseTasks) {
          await ctx.db.patch(t._id, {
            hidden: false,
            status: "To Do",
            assignedTo: undefined,
          });
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
        await ctx.db.delete(t._id);
      }
      await ctx.db.delete(c._id);
    }

    await ctx.db.delete(args.id);
  },
});
