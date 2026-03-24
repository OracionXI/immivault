import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

async function nextInvoiceNumber(ctx: MutationCtx, organisationId: Id<"organisations">): Promise<string> {
  const counter = await ctx.db
    .query("invoiceCounters")
    .withIndex("by_org", (q) => q.eq("organisationId", organisationId))
    .unique();

  if (counter) {
    const n = counter.nextNumber;
    await ctx.db.patch(counter._id, { nextNumber: n + 1 });
    return `INV-${String(n).padStart(4, "0")}`;
  }

  await ctx.db.insert("invoiceCounters", { organisationId, nextNumber: 2 });
  return "INV-0001";
}

/**
 * Scheduled daily at 00:00 UTC.
 * 1. Marks all "Sent" invoices whose dueDate has passed as "Overdue"
 *    (skips contract Draft invoices — they never go overdue).
 * 2. For Installment payment links whose nextPaymentDate has passed and
 *    no overdue invoice was created yet, creates an Overdue invoice record.
 */
export const markOverdueInvoices = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // ── 1. Mark Sent invoices as Overdue (skip contract drafts) ──────────────
    const sentInvoices = await ctx.db
      .query("invoices")
      .filter((q) => q.eq(q.field("status"), "Sent"))
      .collect();

    let marked = 0;
    for (const invoice of sentInvoices) {
      if (invoice.isContractDraft) continue; // never auto-overdue
      if (invoice.dueDate < now) {
        await ctx.db.patch(invoice._id, { status: "Overdue" });
        marked++;
      }
    }

    // ── 2. Create Overdue invoices for expired Installment payment links ──────
    const activeInstallmentLinks = await ctx.db
      .query("paymentLinks")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "Active"),
          q.eq(q.field("paymentType"), "Installment")
        )
      )
      .collect();

    let overdueCreated = 0;
    for (const link of activeInstallmentLinks) {
      if (
        link.nextPaymentDate &&
        link.nextPaymentDate < now &&
        !link.nextPaymentOverdueCreated
      ) {
        const invoiceNumber = await nextInvoiceNumber(ctx, link.organisationId);

        await ctx.db.insert("invoices", {
          organisationId: link.organisationId,
          clientId: link.clientId,
          caseId: link.caseId,
          invoiceNumber,
          status: "Overdue",
          taxRate: 0,
          subtotal: link.amount / 100,
          taxAmount: 0,
          total: link.amount / 100,
          dueDate: link.nextPaymentDate,
          notes: `Overdue installment — ${link.description}`,
        });

        await ctx.db.patch(link._id, { nextPaymentOverdueCreated: true });
        overdueCreated++;
      }
    }

    return { marked, overdueCreated };
  },
});
