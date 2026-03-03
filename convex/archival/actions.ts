"use node";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const fmt = {
  date: (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  datetime: (ms: number) =>
    new Date(ms).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
};

function sectionHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(text, 14, y);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y + 2, 196, y + 2);
  return y + 9;
}

function row(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text(label, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(value, 68, y);
  return y + 6;
}

/**
 * Generates a PDF archival report for a completed case, stores it in
 * Convex Storage, then calls finalizeArchival to mark the case as Archived.
 */
export const generateArchivalReport = internalAction({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.archival.queries.getCaseForArchival, {
      caseId: args.caseId,
    });
    if (!data) return;

    const { case: c, client, assignedManager, tasks } = data;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, 210, 18, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("ImmiVault — Case Archival Report", 14, 12);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${fmt.date(Date.now())}`, 196, 12, { align: "right" });

    let y = 28;

    // ── Client Details ────────────────────────────────────────────────────────
    y = sectionHeading(doc, "Client Details", y);

    if (client) {
      y = row(doc, "Full Name:", `${client.firstName} ${client.lastName}`, y);
      y = row(doc, "Email:", client.email, y);
      if (client.phone) y = row(doc, "Phone:", client.phone, y);
      if (client.nationality) y = row(doc, "Nationality:", client.nationality, y);
      if (client.dateOfBirth)
        y = row(doc, "Date of Birth:", fmt.date(client.dateOfBirth), y);
      if (client.address) y = row(doc, "Address:", client.address, y);
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      doc.text("Client record unavailable.", 14, y);
      y += 6;
    }

    y += 6;

    // ── Case Details ──────────────────────────────────────────────────────────
    y = sectionHeading(doc, "Case Details", y);
    y = row(doc, "Case Number:", c.caseNumber, y);
    y = row(doc, "Title:", c.title, y);
    y = row(doc, "Visa Type:", c.visaType, y);
    y = row(doc, "Status:", c.status, y);
    y = row(doc, "Priority:", c.priority, y);
    y = row(doc, "Created:", fmt.date(c._creationTime), y);
    if (c.completedAt) y = row(doc, "Completed:", fmt.datetime(c.completedAt), y);
    if (c.deadline) y = row(doc, "Deadline:", fmt.date(c.deadline), y);
    if (c.description) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text("Description:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(c.description, 122) as string[];
      doc.text(lines, 68, y);
      y += lines.length * 5 + 1;
    }

    y += 6;

    // ── Assigned Case Manager ─────────────────────────────────────────────────
    y = sectionHeading(doc, "Assigned Case Manager", y);
    if (assignedManager) {
      y = row(doc, "Name:", assignedManager.fullName, y);
      y = row(doc, "Email:", assignedManager.email, y);
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      doc.text("No case manager assigned.", 14, y);
      y += 6;
    }

    y += 6;

    // ── Tasks ─────────────────────────────────────────────────────────────────
    y = sectionHeading(doc, "Tasks", y);

    if (tasks.length === 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      doc.text("No tasks recorded for this case.", 14, y);
    } else {
      autoTable(doc, {
        startY: y,
        head: [["Task Name", "Task ID", "Completion Date & Time"]],
        body: tasks.map((t) => [
          t.title,
          t.taskId,
          t.completedAt ? fmt.datetime(t.completedAt) : "—",
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 35 },
          2: { cellWidth: 67 },
        },
      });
    }

    // ── S3 Glacier stub ───────────────────────────────────────────────────────
    // TODO: Phase N — Move PDF to S3 Glacier for long-term cold storage
    // await moveToGlacier(storageId, `archives/${c.caseNumber}.pdf`);

    const pdfBytes = doc.output("arraybuffer");
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const storageId = await ctx.storage.store(blob);

    await ctx.runMutation(internal.archival.mutations.finalizeArchival, {
      caseId: args.caseId,
      storageId,
    });
  },
});
