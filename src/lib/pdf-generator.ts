"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Convex-compatible types accepted by the report generator
export type ReportClient = {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    nationality?: string;
    status: string;
    _creationTime: number;
};

export type ReportCase = {
    title: string;
    visaType: string;
    status: string;
    priority: string;
    caseNumber: string;
    assigneeName: string; // pre-resolved by caller
};

export type ReportInvoice = {
    invoiceNumber: string;
    total: number;
    status: string;
    dueDate: number;
    issuedAt?: number;
};

export type ReportPayment = {
    paidAt: number;
    amount: number;
    method: string;
    status: string;
    reference?: string;
};

function fmtDate(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function generateClientReport(
    client: ReportClient,
    cases: ReportCase[],
    invoices: ReportInvoice[],
    payments: ReportPayment[]
) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const fullName = `${client.firstName} ${client.lastName}`;

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
        ["Name", fullName],
        ["Email", client.email],
        ["Phone", client.phone ?? "—"],
        ["Nationality", client.nationality ?? "—"],
        ["Status", client.status],
        ["Client Since", fmtDate(client._creationTime)],
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
            head: [["Case #", "Title", "Visa Type", "Status", "Priority", "Assigned To"]],
            body: cases.map((c) => [c.caseNumber, c.title, c.visaType, c.status, c.priority, c.assigneeName]),
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
            head: [["Invoice #", "Total", "Status", "Issued", "Due"]],
            body: invoices.map((i) => [
                i.invoiceNumber,
                `$${i.total.toLocaleString()}`,
                i.status,
                i.issuedAt ? fmtDate(i.issuedAt) : "—",
                fmtDate(i.dueDate),
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
                fmtDate(p.paidAt),
                `$${p.amount.toLocaleString()}`,
                p.method,
                p.status,
                p.reference ?? "—",
            ]),
            headStyles: { fillColor: [15, 23, 42] },
            styles: { fontSize: 9 },
        });
    }

    doc.save(`ImmiVault_Report_${fullName.replace(/\s+/g, "_")}.pdf`);
}
