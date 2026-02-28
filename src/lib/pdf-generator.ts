"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Client, Case, Invoice, Payment } from "./types";

export function generateClientReport(
    client: Client,
    cases: Case[],
    invoices: Invoice[],
    payments: Payment[]
) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("ImmiVault", 14, 18);
    doc.setFontSize(12);
    doc.text("Client Report", 14, 28);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 28, { align: "right" });

    // Client Info
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.text("Client Information", 14, 54);
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    const clientInfo = [
        ["Name", client.name],
        ["Email", client.email],
        ["Phone", client.phone],
        ["Nationality", client.nationality],
        ["Visa Type", client.visaType],
        ["Status", client.status.charAt(0).toUpperCase() + client.status.slice(1)],
        ["Client Since", client.createdAt],
    ];

    autoTable(doc, {
        startY: 58,
        body: clientInfo,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
    });

    // Cases
    const finalY1 = (doc as unknown as Record<string, { finalY: number }>).lastAutoTable?.finalY ?? 120;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text("Cases", 14, finalY1 + 14);

    if (cases.length > 0) {
        autoTable(doc, {
            startY: finalY1 + 18,
            head: [["Title", "Visa Type", "Stage", "Priority", "Assigned To"]],
            body: cases.map((c) => [c.title, c.visaType, c.stage, c.priority, c.assignedTo]),
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 9 },
        });
    }

    // Invoices
    const finalY2 = (doc as unknown as Record<string, { finalY: number }>).lastAutoTable?.finalY ?? 180;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text("Invoices", 14, finalY2 + 14);

    if (invoices.length > 0) {
        autoTable(doc, {
            startY: finalY2 + 18,
            head: [["Invoice #", "Amount", "Status", "Issued", "Due"]],
            body: invoices.map((i) => [
                i.invoiceNumber,
                `$${i.totalAmount.toLocaleString()}`,
                i.status,
                i.issuedDate,
                i.dueDate,
            ]),
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 9 },
        });
    }

    // Payments
    const finalY3 = (doc as unknown as Record<string, { finalY: number }>).lastAutoTable?.finalY ?? 240;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text("Payment History", 14, finalY3 + 14);

    if (payments.length > 0) {
        autoTable(doc, {
            startY: finalY3 + 18,
            head: [["Date", "Amount", "Method", "Status", "Reference"]],
            body: payments.map((p) => [
                p.date,
                `$${p.amount.toLocaleString()}`,
                p.method,
                p.status,
                p.reference,
            ]),
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 9 },
        });
    }

    doc.save(`ImmiVault_Report_${client.name.replace(/\s+/g, "_")}.pdf`);
}
