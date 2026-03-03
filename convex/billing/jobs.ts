import { internalMutation } from "../_generated/server";

/**
 * Scheduled daily at 00:00 UTC.
 * Marks all "Sent" invoices whose dueDate has passed as "Overdue".
 */
export const markOverdueInvoices = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Collect all orgs (we scan the organisations table to get all orgIds)
    // Since invoices are indexed by org+status, we query Sent invoices globally
    // using the by_org_and_status index across all orgs via a full collect.
    // Volume is bounded: typically <10k invoices per deployment.
    const sentInvoices = await ctx.db
      .query("invoices")
      .filter((q) => q.eq(q.field("status"), "Sent"))
      .collect();

    let marked = 0;
    for (const invoice of sentInvoices) {
      if (invoice.dueDate < now) {
        await ctx.db.patch(invoice._id, { status: "Overdue" });
        marked++;
      }
    }

    return { marked };
  },
});
