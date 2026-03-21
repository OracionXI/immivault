"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./utils";

// ── Audit Report types ────────────────────────────────────────────────────────

export type AuditPaymentRow = {
    reference?: string;
    clientName: string;
    amount: number; // in cents
    method: string;
    status: string;
    dateDisplay: string;
    notes?: string;
};

// ── Shared types ──────────────────────────────────────────────────────────────

export type ReportClient = {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    nationality?: string;
    status: string;
    _creationTime: number;
    contractAmount?: number; // in cents
};

export type ReportCase = {
    title: string;
    visaType: string;
    status: string;
    priority: string;
    caseNumber: string;
    assigneeName: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function lastY(doc: jsPDF): number {
    return (
        (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
            ?.finalY ?? 0
    );
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generateClientReport(
    client: ReportClient,
    cases: ReportCase[],
    invoices: ReportInvoice[],
    payments: ReportPayment[],
    orgName = "ImmiVault",
    orgSignature?: string,
    currency = "USD"
) {
    const doc = new jsPDF({ format: "letter", unit: "mm" });
    const PW = doc.internal.pageSize.getWidth();  // 215.9 mm
    const M  = 12;                                 // margin
    const CW = PW - 2 * M;                        // content width

    const fullName    = `${client.firstName} ${client.lastName}`;
    const today       = new Date().toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
    });
    const periodStart = fmtDate(client._creationTime);
    const periodEnd   = new Date().toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
    });

    // Derive case manager label (first unique manager; +N if multiple)
    const uniqueManagers = [...new Set(cases.map((c) => c.assigneeName).filter(Boolean))];
    const caseManager = uniqueManagers.length === 0 ? "—"
        : uniqueManagers.length === 1 ? uniqueManagers[0]
        : `${uniqueManagers[0]} +${uniqueManagers.length - 1}`;

    const totalInvoiced  = invoices.reduce((s, i) => s + i.total, 0);
    const totalPaid      = payments
        .filter((p) => p.status === "Completed")
        .reduce((s, p) => s + p.amount, 0) / 100;
    const totalPending   = invoices
        .filter((i) => i.status === "Sent" || i.status === "Overdue")
        .reduce((s, i) => s + i.total, 0);
    const overdueCount   = invoices.filter((i) => i.status === "Overdue").length;

    // ── Drawing primitives ──────────────────────────────────────────────────

    function cell(x: number, y: number, w: number, h: number) {
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.rect(x, y, w, h);
    }

    function sectionBar(label: string, x: number, y: number, w: number, h = 7) {
        doc.setFillColor(220, 220, 220);
        doc.rect(x, y, w, h, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(label, x + w / 2, y + h / 2 + 1.5, { align: "center" });
        doc.setFont("helvetica", "normal");
    }

    function fieldLabel(text: string, x: number, y: number) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        doc.text(text, x + 1.5, y + 3);
    }

    function fieldValue(text: string, x: number, y: number, maxW?: number) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        if (maxW) {
            doc.text(text, x + 2, y + 8.5, { maxWidth: maxW - 4 });
        } else {
            doc.text(text, x + 2, y + 8.5);
        }
    }

    function commentBox(
        label: string,
        value: string,
        x: number,
        y: number,
        w: number,
        h: number,
        valueColor?: [number, number, number]
    ) {
        cell(x, y, w, h);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(label, x + 2, y + 4.5);
        if (value) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...(valueColor ?? [0, 0, 0]));
            doc.text(value, x + 4, y + 11, { maxWidth: w - 6 });
            doc.setTextColor(0, 0, 0);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HEADER — title block + instruction
    // ─────────────────────────────────────────────────────────────────────────
    let y = M;
    const hdrH   = 20;
    const titleW = CW * 0.44;
    const instrW = CW - titleW;

    cell(M, y, titleW, hdrH);
    cell(M + titleW, y, instrW, hdrH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(orgName.toUpperCase(), M + titleW / 2, y + 7.5, { align: "center" });
    doc.setFontSize(10.5);
    doc.text("CLIENT CASE REPORT", M + titleW / 2, y + 14.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(
        "This report must be completed and submitted with each client\nfile review. Additional documents may be attached as needed.",
        M + titleW + 3,
        y + 8,
        { maxWidth: instrW - 5 }
    );

    y += hdrH;

    // ─────────────────────────────────────────────────────────────────────────
    // INFO ROWS — 5 fields only
    //   Row 1: ORGANISATION NAME (50%) | DATE OF REPORT (50%)
    //   Row 2: CLIENT NAME (50%)       | CASE MANAGER (50%)
    //   Row 3: FOR PERIOD COVERING (full width)
    // ─────────────────────────────────────────────────────────────────────────
    const rowH = 12;
    const half = CW / 2;

    // Row 1
    cell(M,        y, half, rowH);
    cell(M + half, y, half, rowH);
    fieldLabel("1.  ORGANISATION NAME:", M, y);
    fieldValue(orgName, M, y, half);
    fieldLabel("2.  DATE OF REPORT:", M + half, y);
    fieldValue(today, M + half, y, half);
    y += rowH;

    // Row 2
    cell(M,        y, half, rowH);
    cell(M + half, y, half, rowH);
    fieldLabel("3.  CLIENT NAME:", M, y);
    fieldValue(fullName, M, y, half);
    fieldLabel("4.  CASE MANAGER:", M + half, y);
    fieldValue(caseManager, M + half, y, half);
    y += rowH;

    // Row 3
    cell(M, y, CW, rowH);
    fieldLabel("5.  FOR PERIOD COVERING:", M, y);
    fieldValue(`${periodStart} – ${periodEnd}`, M, y, CW);
    y += rowH;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6 — Cases
    // ─────────────────────────────────────────────────────────────────────────
    sectionBar("6.  CASES", M, y, CW);
    y += 7;

    if (cases.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: M, right: M },
            head: [["a. Case #", "b. Case Title", "c. Visa Type", "d. Status", "e. Priority", "f. Assigned To"]],
            body: cases.map((c) => [
                c.caseNumber,
                c.title,
                c.visaType,
                c.status,
                c.priority,
                c.assigneeName,
            ]),
            headStyles: {
                fillColor: [200, 200, 200],
                textColor: [0, 0, 0],
                fontStyle: "bold",
                fontSize: 7.5,
                cellPadding: 2.5,
                lineColor: [0, 0, 0],
                lineWidth: 0.2,
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 2.5,
                lineColor: [0, 0, 0],
                lineWidth: 0.2,
                textColor: [0, 0, 0],
            },
            tableLineColor: [0, 0, 0],
            tableLineWidth: 0.2,
            columnStyles: {
                0: { cellWidth: 22 },
                2: { cellWidth: 28 },
                3: { cellWidth: 24 },
                4: { cellWidth: 20 },
                5: { cellWidth: 30 },
            },
        });
        y = lastY(doc);
    } else {
        // Empty placeholder rows
        const cols = [22, 66, 28, 24, 20, 30];
        const hdrs = ["a. Case #", "b. Case Title", "c. Visa Type", "d. Status", "e. Priority", "f. Assigned To"];
        let cx = M;
        for (let ci = 0; ci < cols.length; ci++) {
            cell(cx, y, cols[ci], 7);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.text(hdrs[ci], cx + 1.5, y + 4.5);
            cx += cols[ci];
        }
        y += 7;
        for (let r = 0; r < 6; r++) {
            cx = M;
            for (let ci = 0; ci < cols.length; ci++) {
                cell(cx, y, cols[ci], 8);
                cx += cols[ci];
            }
            y += 8;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7 — Financial Summary
    // ─────────────────────────────────────────────────────────────────────────
    sectionBar("7.  FINANCIAL SUMMARY", M, y, CW);
    y += 7;

    const boxH = 18;
    let boxIdx = 0;
    const boxLabel = () => String.fromCharCode(97 + boxIdx++) + ".  ";

    if (client.contractAmount && client.contractAmount > 0) {
        commentBox(
            `${boxLabel()}Contract amount:`,
            formatCurrency(client.contractAmount / 100, currency),
            M, y, CW, boxH
        );
        y += boxH;
    }

    commentBox(
        `${boxLabel()}Total amount invoiced to client:`,
        formatCurrency(totalInvoiced, currency),
        M, y, CW, boxH
    );
    y += boxH;

    commentBox(
        `${boxLabel()}Total payments received:`,
        formatCurrency(totalPaid, currency),
        M, y, CW, boxH
    );
    y += boxH;

    const pendingLabel = overdueCount > 0
        ? `${formatCurrency(totalPending, currency)}   (${overdueCount} overdue invoice${overdueCount > 1 ? "s" : ""})`
        : formatCurrency(totalPending, currency);
    commentBox(
        `${boxLabel()}Outstanding balance:`,
        pendingLabel,
        M, y, CW, boxH,
        overdueCount > 0 ? [180, 0, 0] : undefined
    );
    y += boxH;

    commentBox(
        `${boxLabel()}If outstanding balance exists and continued case management is recommended, outline next steps:`,
        "",
        M, y, CW, boxH
    );
    y += boxH;

    // ─────────────────────────────────────────────────────────────────────────
    // SIGNATURE ROW
    // ─────────────────────────────────────────────────────────────────────────
    const sigH     = 20;
    const sigNameW = CW * 0.65;
    const sigDateW = CW - sigNameW;

    cell(M,            y, sigNameW, sigH);
    cell(M + sigNameW, y, sigDateW, sigH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text("AUTHORISED SIGNATURE:", M + 2, y + 4.5);
    doc.text("DATE:", M + sigNameW + 2, y + 4.5);

    // Render the org's stored signature
    if (orgSignature) {
        if (orgSignature.startsWith("data:image")) {
            // PNG / drawn signature — fit inside the cell with padding
            try {
                doc.addImage(orgSignature, "PNG", M + 3, y + 6, sigNameW - 6, sigH - 8);
            } catch {
                // Fallback to text if image decode fails
                doc.setFont("helvetica", "bolditalic");
                doc.setFontSize(13);
                doc.setTextColor(0, 0, 0);
                doc.text(orgName, M + 4, y + sigH - 4, { maxWidth: sigNameW - 8 });
            }
        } else {
            // Typed name — render in a large italic font to look like a signature
            doc.setFont("helvetica", "bolditalic");
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 100);
            doc.text(orgSignature, M + 4, y + sigH - 4, { maxWidth: sigNameW - 8 });
        }
    }

    // Date in the right cell
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(today, M + sigNameW + 2, y + sigH - 5);

    y += sigH;

    // Footer distribution line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(
        "DISTRIBUTION:     ORIGINAL     CLIENT COPY",
        M + CW / 2,
        y + 6,
        { align: "center" }
    );

    // ── Save ──────────────────────────────────────────────────────────────────
    doc.save(
        `${orgName.replace(/\s+/g, "_")}_Report_${fullName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`
    );
}

// ── Audit Report Generator ────────────────────────────────────────────────────

export function generateAuditReport(
    rows: AuditPaymentRow[],
    orgName = "ImmiVault",
    orgSignature?: string,
    dateFrom?: string,
    dateTo?: string,
    currency = "USD"
) {
    const doc = new jsPDF({ format: "letter", unit: "mm" });
    const PW = doc.internal.pageSize.getWidth();
    const M  = 12;
    const CW = PW - 2 * M;

    const today = new Date().toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
    });
    const period = dateFrom && dateTo
        ? `${dateFrom} – ${dateTo}`
        : dateFrom ? `From ${dateFrom}` : dateTo ? `To ${dateTo}` : "All time";

    const totalCollected = rows
        .filter((r) => r.status === "Completed")
        .reduce((s, r) => s + r.amount, 0) / 100;
    const totalRefunded = rows
        .filter((r) => r.status === "Refunded")
        .reduce((s, r) => s + r.amount, 0) / 100;
    const totalPending = rows
        .filter((r) => r.status === "Pending")
        .reduce((s, r) => s + r.amount, 0) / 100;

    function cell(x: number, y: number, w: number, h: number) {
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.rect(x, y, w, h);
    }

    function sectionBar(label: string, x: number, y: number, w: number, h = 7) {
        doc.setFillColor(220, 220, 220);
        doc.rect(x, y, w, h, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(label, x + w / 2, y + h / 2 + 1.5, { align: "center" });
        doc.setFont("helvetica", "normal");
    }

    function fieldLabel(text: string, x: number, y: number) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(0, 0, 0);
        doc.text(text, x + 1.5, y + 3);
    }

    function fieldValue(text: string, x: number, y: number, maxW?: number) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        if (maxW) {
            doc.text(text, x + 2, y + 8.5, { maxWidth: maxW - 4 });
        } else {
            doc.text(text, x + 2, y + 8.5);
        }
    }

    function commentBox(label: string, value: string, x: number, y: number, w: number, h: number, valueColor?: [number, number, number]) {
        cell(x, y, w, h);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(label, x + 2, y + 4.5);
        if (value) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...(valueColor ?? [0, 0, 0]));
            doc.text(value, x + 4, y + 11, { maxWidth: w - 6 });
            doc.setTextColor(0, 0, 0);
        }
    }

    // ── Header ────────────────────────────────────────────────────────────────
    let y = M;
    const hdrH   = 20;
    const titleW = CW * 0.44;
    const instrW = CW - titleW;

    cell(M, y, titleW, hdrH);
    cell(M + titleW, y, instrW, hdrH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(orgName.toUpperCase(), M + titleW / 2, y + 7.5, { align: "center" });
    doc.setFontSize(10.5);
    doc.text("PAYMENT AUDIT REPORT", M + titleW / 2, y + 14.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(
        "This audit report summarises all recorded payment transactions\nfor the specified period. For submission to financial institutions.",
        M + titleW + 3,
        y + 8,
        { maxWidth: instrW - 5 }
    );
    y += hdrH;

    // ── Info rows ─────────────────────────────────────────────────────────────
    const rowH = 12;
    const half = CW / 2;

    cell(M, y, half, rowH);
    cell(M + half, y, half, rowH);
    fieldLabel("1.  ORGANISATION NAME:", M, y);
    fieldValue(orgName, M, y, half);
    fieldLabel("2.  DATE OF REPORT:", M + half, y);
    fieldValue(today, M + half, y, half);
    y += rowH;

    cell(M, y, half, rowH);
    cell(M + half, y, half, rowH);
    fieldLabel("3.  TOTAL TRANSACTIONS:", M, y);
    fieldValue(String(rows.length), M, y, half);
    fieldLabel("4.  PERIOD COVERED:", M + half, y);
    fieldValue(period, M + half, y, half);
    y += rowH;

    // ── Section 5: Transactions table ─────────────────────────────────────────
    sectionBar("5.  TRANSACTION RECORDS", M, y, CW);
    y += 7;

    if (rows.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: M, right: M },
            head: [["a. Reference", "b. Client", "c. Amount", "d. Method", "e. Status", "f. Date"]],
            body: rows.map((r) => [
                r.reference ?? "—",
                r.clientName,
                formatCurrency(r.amount / 100, currency),
                r.method,
                r.status,
                r.dateDisplay,
            ]),
            headStyles: {
                fillColor: [200, 200, 200],
                textColor: [0, 0, 0],
                fontStyle: "bold",
                fontSize: 7.5,
                cellPadding: 2.5,
                lineColor: [0, 0, 0],
                lineWidth: 0.2,
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 2.5,
                lineColor: [0, 0, 0],
                lineWidth: 0.2,
                textColor: [0, 0, 0],
            },
            tableLineColor: [0, 0, 0],
            tableLineWidth: 0.2,
            columnStyles: {
                0: { cellWidth: 36 },
                2: { cellWidth: 22 },
                3: { cellWidth: 22 },
                4: { cellWidth: 22 },
                5: { cellWidth: 28 },
            },
        });
        y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    } else {
        cell(M, y, CW, 14);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("No transactions found for this period.", M + CW / 2, y + 8.5, { align: "center" });
        y += 14;
    }

    // ── Section 6: Financial summary ──────────────────────────────────────────
    sectionBar("6.  FINANCIAL SUMMARY", M, y, CW);
    y += 7;

    const boxH = 16;
    commentBox("a.  Total collected (Completed):", formatCurrency(totalCollected, currency), M, y, CW, boxH, [0, 120, 0]);
    y += boxH;
    commentBox("b.  Total pending:", formatCurrency(totalPending, currency), M, y, CW, boxH, [160, 100, 0]);
    y += boxH;
    commentBox("c.  Total refunded:", formatCurrency(totalRefunded, currency), M, y, CW, boxH, [160, 0, 0]);
    y += boxH;

    // ── Signature ─────────────────────────────────────────────────────────────
    const sigH     = 20;
    const sigNameW = CW * 0.65;
    const sigDateW = CW - sigNameW;

    cell(M, y, sigNameW, sigH);
    cell(M + sigNameW, y, sigDateW, sigH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text("AUTHORISED SIGNATURE:", M + 2, y + 4.5);
    doc.text("DATE:", M + sigNameW + 2, y + 4.5);

    if (orgSignature) {
        if (orgSignature.startsWith("data:image")) {
            try {
                doc.addImage(orgSignature, "PNG", M + 3, y + 6, sigNameW - 6, sigH - 8);
            } catch {
                doc.setFont("helvetica", "bolditalic");
                doc.setFontSize(13);
                doc.setTextColor(0, 0, 0);
                doc.text(orgName, M + 4, y + sigH - 4, { maxWidth: sigNameW - 8 });
            }
        } else {
            doc.setFont("helvetica", "bolditalic");
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 100);
            doc.text(orgSignature, M + 4, y + sigH - 4, { maxWidth: sigNameW - 8 });
        }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(today, M + sigNameW + 2, y + sigH - 5);
    y += sigH;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(
        "DISTRIBUTION:     ORIGINAL     BANK COPY     ACCOUNTS COPY",
        M + CW / 2,
        y + 6,
        { align: "center" }
    );

    doc.save(
        `${orgName.replace(/\s+/g, "_")}_Audit_${new Date().toISOString().slice(0, 10)}.pdf`
    );
}
