// ============================================================
// ImmiVault — Mock Data
// ============================================================

import {
    Client, Case, Task, Document, Appointment, Invoice, Payment,
    PaymentLink, Staff, CaseStageConfig, EmailTemplate,
    AutomationRule, BankAccount, BookingSettings, CompanyProfile,
} from "./types";

export const mockClients: Client[] = [
    { id: "c1", name: "Maria Rodriguez", email: "maria@email.com", phone: "+1-555-0101", nationality: "Mexican", visaType: "H-1B", status: "active", createdAt: "2025-12-15" },
    { id: "c2", name: "Chen Wei", email: "chen.wei@email.com", phone: "+1-555-0102", nationality: "Chinese", visaType: "F-1", status: "active", createdAt: "2025-11-20" },
    { id: "c3", name: "Amit Sharma", email: "amit.sharma@email.com", phone: "+1-555-0103", nationality: "Indian", visaType: "L-1A", status: "pending", createdAt: "2026-01-05" },
    { id: "c4", name: "Sophie Laurent", email: "sophie.l@email.com", phone: "+1-555-0104", nationality: "French", visaType: "O-1", status: "active", createdAt: "2025-10-10" },
    { id: "c5", name: "Yuki Tanaka", email: "yuki.t@email.com", phone: "+1-555-0105", nationality: "Japanese", visaType: "E-2", status: "inactive", createdAt: "2025-09-01" },
    { id: "c6", name: "Ahmed Hassan", email: "ahmed.h@email.com", phone: "+1-555-0106", nationality: "Egyptian", visaType: "EB-2", status: "active", createdAt: "2026-01-20" },
    { id: "c7", name: "Elena Popov", email: "elena.p@email.com", phone: "+1-555-0107", nationality: "Russian", visaType: "H-1B", status: "archived", createdAt: "2025-06-15" },
    { id: "c8", name: "James Okafor", email: "james.o@email.com", phone: "+1-555-0108", nationality: "Nigerian", visaType: "EB-1", status: "active", createdAt: "2026-02-01" },
];

export const mockCases: Case[] = [
    { id: "cs1", title: "H-1B Petition – Maria Rodriguez", clientId: "c1", clientName: "Maria Rodriguez", visaType: "H-1B", stage: "In Progress", assignedTo: "Sarah Chen", priority: "High", notes: "Employer petition filed.", createdAt: "2026-01-10", updatedAt: "2026-02-15" },
    { id: "cs2", title: "F-1 OPT Extension – Chen Wei", clientId: "c2", clientName: "Chen Wei", visaType: "F-1", stage: "New", assignedTo: "John Miller", priority: "Medium", notes: "STEM OPT extension.", createdAt: "2026-02-01", updatedAt: "2026-02-20" },
    { id: "cs3", title: "L-1A Transfer – Amit Sharma", clientId: "c3", clientName: "Amit Sharma", visaType: "L-1A", stage: "Under Review", assignedTo: "Sarah Chen", priority: "Urgent", notes: "Intra-company transferee.", createdAt: "2026-01-15", updatedAt: "2026-02-25" },
    { id: "cs4", title: "O-1 Extraordinary – Sophie Laurent", clientId: "c4", clientName: "Sophie Laurent", visaType: "O-1", stage: "Approved", assignedTo: "Emily Davis", priority: "Medium", notes: "Arts category.", createdAt: "2025-11-01", updatedAt: "2026-02-10" },
    { id: "cs5", title: "E-2 Investor – Yuki Tanaka", clientId: "c5", clientName: "Yuki Tanaka", visaType: "E-2", stage: "Closed", assignedTo: "John Miller", priority: "Low", notes: "Treaty investor visa.", createdAt: "2025-08-15", updatedAt: "2026-01-20" },
    { id: "cs6", title: "EB-2 NIW – Ahmed Hassan", clientId: "c6", clientName: "Ahmed Hassan", visaType: "EB-2", stage: "New", assignedTo: "Emily Davis", priority: "High", notes: "National Interest Waiver.", createdAt: "2026-02-01", updatedAt: "2026-02-28" },
    { id: "cs7", title: "EB-1 Outstanding – James Okafor", clientId: "c8", clientName: "James Okafor", visaType: "EB-1", stage: "In Progress", assignedTo: "Sarah Chen", priority: "High", notes: "Outstanding researcher.", createdAt: "2026-02-10", updatedAt: "2026-02-28" },
];

export const mockTasks: Task[] = [
    { id: "t1", title: "Collect employment verification letter", description: "Request and collect employment verification from HR.", assignee: "Sarah Chen", priority: "High", status: "In Progress", dueDate: "2026-03-01", caseId: "cs1", caseName: "H-1B Petition – Maria Rodriguez", createdAt: "2026-02-15" },
    { id: "t2", title: "File I-20 extension request", description: "Prepare and submit I-20 extension documentation.", assignee: "John Miller", priority: "Medium", status: "To Do", dueDate: "2026-03-05", caseId: "cs2", caseName: "F-1 OPT Extension – Chen Wei", createdAt: "2026-02-20" },
    { id: "t3", title: "Review L-1A petition documents", description: "Review all submitted petition documents for completeness.", assignee: "Sarah Chen", priority: "Urgent", status: "Review", dueDate: "2026-02-28", caseId: "cs3", caseName: "L-1A Transfer – Amit Sharma", createdAt: "2026-02-22" },
    { id: "t4", title: "Schedule USCIS interview prep", description: "Coordinate interview preparation session with client.", assignee: "Emily Davis", priority: "Medium", status: "To Do", dueDate: "2026-03-10", caseId: "cs4", caseName: "O-1 Extraordinary – Sophie Laurent", createdAt: "2026-02-18" },
    { id: "t5", title: "Prepare recommendation letters", description: "Draft and collect recommendation letters from experts.", assignee: "Emily Davis", priority: "High", status: "In Progress", dueDate: "2026-03-15", caseId: "cs6", caseName: "EB-2 NIW – Ahmed Hassan", createdAt: "2026-02-25" },
    { id: "t6", title: "Submit biometric appointment", description: "Book and confirm biometric appointment.", assignee: "John Miller", priority: "Low", status: "Done", dueDate: "2026-02-20", caseId: "cs1", caseName: "H-1B Petition – Maria Rodriguez", createdAt: "2026-02-10" },
    { id: "t7", title: "Update case status in database", description: "Update the internal tracking for approved case.", assignee: "Sarah Chen", priority: "Low", status: "Done", dueDate: "2026-02-15", caseId: "cs4", caseName: "O-1 Extraordinary – Sophie Laurent", createdAt: "2026-02-12" },
    { id: "t8", title: "Research EB-1 criteria", description: "Research and document qualification criteria for EB-1.", assignee: "Sarah Chen", priority: "High", status: "To Do", dueDate: "2026-03-08", caseId: "cs7", caseName: "EB-1 Outstanding – James Okafor", createdAt: "2026-02-26" },
];

export const mockDocuments: Document[] = [
    { id: "d1", name: "Passport – Maria Rodriguez", type: "Identity", clientId: "c1", clientName: "Maria Rodriguez", status: "active", uploadedAt: "2026-01-10", expiryDate: "2030-06-15", fileSize: "2.4 MB" },
    { id: "d2", name: "Employment Letter – Maria Rodriguez", type: "Employment", clientId: "c1", clientName: "Maria Rodriguez", status: "active", uploadedAt: "2026-02-01", fileSize: "1.1 MB" },
    { id: "d3", name: "I-20 Form – Chen Wei", type: "Immigration", clientId: "c2", clientName: "Chen Wei", status: "active", uploadedAt: "2026-01-25", expiryDate: "2027-05-30", fileSize: "0.8 MB" },
    { id: "d4", name: "Degree Certificate – Amit Sharma", type: "Education", clientId: "c3", clientName: "Amit Sharma", status: "pending", uploadedAt: "2026-02-10", fileSize: "3.2 MB" },
    { id: "d5", name: "Recommendation Letter – Sophie Laurent", type: "Supporting", clientId: "c4", clientName: "Sophie Laurent", status: "active", uploadedAt: "2025-12-20", fileSize: "0.5 MB" },
    { id: "d6", name: "Business Plan – Yuki Tanaka", type: "Business", clientId: "c5", clientName: "Yuki Tanaka", status: "archived", uploadedAt: "2025-09-05", fileSize: "5.7 MB" },
    { id: "d7", name: "Research Papers – Ahmed Hassan", type: "Supporting", clientId: "c6", clientName: "Ahmed Hassan", status: "active", uploadedAt: "2026-02-15", fileSize: "8.1 MB" },
    { id: "d8", name: "Tax Returns – James Okafor", type: "Financial", clientId: "c8", clientName: "James Okafor", status: "active", uploadedAt: "2026-02-20", fileSize: "1.9 MB" },
];

export const mockAppointments: Appointment[] = [
    { id: "a1", clientId: "c1", clientName: "Maria Rodriguez", type: "Consultation", date: "2026-03-01", time: "10:00 AM", duration: "60 min", location: "Office – Room 201", notes: "Initial H-1B consultation.", status: "active" },
    { id: "a2", clientId: "c3", clientName: "Amit Sharma", type: "Document Review", date: "2026-03-02", time: "2:00 PM", duration: "45 min", location: "Virtual – Zoom", notes: "Review L-1A documents.", status: "active" },
    { id: "a3", clientId: "c4", clientName: "Sophie Laurent", type: "Interview Prep", date: "2026-03-05", time: "11:00 AM", duration: "90 min", location: "Office – Room 103", notes: "Prepare for O-1 interview.", status: "pending" },
    { id: "a4", clientId: "c6", clientName: "Ahmed Hassan", type: "Follow-up", date: "2026-03-08", time: "3:00 PM", duration: "30 min", location: "Virtual – Teams", notes: "EB-2 case update.", status: "active" },
    { id: "a5", clientId: "c2", clientName: "Chen Wei", type: "Consultation", date: "2026-02-28", time: "9:00 AM", duration: "60 min", location: "Office – Room 201", notes: "OPT extension discussion.", status: "inactive" },
];

export const mockInvoices: Invoice[] = [
    { id: "inv1", invoiceNumber: "INV-2026-001", clientId: "c1", clientName: "Maria Rodriguez", items: [{ description: "H-1B Petition Filing", quantity: 1, unitPrice: 3500, total: 3500 }, { description: "Legal Consultation", quantity: 2, unitPrice: 250, total: 500 }], totalAmount: 4000, status: "Paid", issuedDate: "2026-01-15", dueDate: "2026-02-15", notes: "" },
    { id: "inv2", invoiceNumber: "INV-2026-002", clientId: "c3", clientName: "Amit Sharma", items: [{ description: "L-1A Transfer Processing", quantity: 1, unitPrice: 5000, total: 5000 }], totalAmount: 5000, status: "Sent", issuedDate: "2026-02-01", dueDate: "2026-03-01", notes: "Premium processing included." },
    { id: "inv3", invoiceNumber: "INV-2026-003", clientId: "c4", clientName: "Sophie Laurent", items: [{ description: "O-1 Visa Application", quantity: 1, unitPrice: 4500, total: 4500 }, { description: "Interview Prep Session", quantity: 1, unitPrice: 300, total: 300 }], totalAmount: 4800, status: "Paid", issuedDate: "2025-11-20", dueDate: "2025-12-20", notes: "" },
    { id: "inv4", invoiceNumber: "INV-2026-004", clientId: "c6", clientName: "Ahmed Hassan", items: [{ description: "EB-2 NIW Application", quantity: 1, unitPrice: 6000, total: 6000 }], totalAmount: 6000, status: "Draft", issuedDate: "2026-02-20", dueDate: "2026-03-20", notes: "Pending review." },
    { id: "inv5", invoiceNumber: "INV-2026-005", clientId: "c2", clientName: "Chen Wei", items: [{ description: "F-1 OPT Extension", quantity: 1, unitPrice: 1500, total: 1500 }], totalAmount: 1500, status: "Overdue", issuedDate: "2026-01-10", dueDate: "2026-02-10", notes: "Follow up required." },
];

export const mockPayments: Payment[] = [
    { id: "p1", invoiceId: "inv1", clientId: "c1", clientName: "Maria Rodriguez", amount: 4000, method: "Credit Card", status: "Completed", date: "2026-02-10", reference: "TXN-001234" },
    { id: "p2", invoiceId: "inv3", clientId: "c4", clientName: "Sophie Laurent", amount: 4800, method: "Bank Transfer", status: "Completed", date: "2025-12-18", reference: "TXN-001235" },
    { id: "p3", invoiceId: "inv2", clientId: "c3", clientName: "Amit Sharma", amount: 2500, method: "Credit Card", status: "Pending", date: "2026-02-25", reference: "TXN-001236" },
    { id: "p4", invoiceId: "inv5", clientId: "c2", clientName: "Chen Wei", amount: 1500, method: "PayPal", status: "Failed", date: "2026-02-12", reference: "TXN-001237" },
];

export const mockPaymentLinks: PaymentLink[] = [
    { id: "pl1", clientId: "c3", clientName: "Amit Sharma", amount: 2500, description: "L-1A Transfer – Remaining Balance", link: "https://pay.immivault.com/pl1", status: "active", expiryDate: "2026-03-15", createdAt: "2026-02-20" },
    { id: "pl2", clientId: "c6", clientName: "Ahmed Hassan", amount: 6000, description: "EB-2 NIW Application Fee", link: "https://pay.immivault.com/pl2", status: "active", expiryDate: "2026-03-30", createdAt: "2026-02-22" },
    { id: "pl3", clientId: "c2", clientName: "Chen Wei", amount: 1500, description: "F-1 OPT Extension Fee", link: "https://pay.immivault.com/pl3", status: "inactive", expiryDate: "2026-02-28", createdAt: "2026-01-15" },
];

export const mockStaff: Staff[] = [
    { id: "s1", name: "Sarah Chen", email: "sarah.chen@immivault.com", role: "Senior Immigration Attorney", department: "Legal", status: "active", joinedAt: "2024-03-01" },
    { id: "s2", name: "John Miller", email: "john.miller@immivault.com", role: "Immigration Paralegal", department: "Legal", status: "active", joinedAt: "2024-06-15" },
    { id: "s3", name: "Emily Davis", email: "emily.davis@immivault.com", role: "Case Manager", department: "Operations", status: "active", joinedAt: "2024-09-01" },
    { id: "s4", name: "Michael Torres", email: "michael.t@immivault.com", role: "Admin Assistant", department: "Administration", status: "active", joinedAt: "2025-01-10" },
    { id: "s5", name: "Lisa Park", email: "lisa.park@immivault.com", role: "Junior Paralegal", department: "Legal", status: "inactive", joinedAt: "2025-04-20" },
];

export const mockCaseStages: CaseStageConfig[] = [
    { id: "st1", name: "New", color: "#3b82f6", order: 1 },
    { id: "st2", name: "In Progress", color: "#f59e0b", order: 2 },
    { id: "st3", name: "Under Review", color: "#8b5cf6", order: 3 },
    { id: "st4", name: "Approved", color: "#10b981", order: 4 },
    { id: "st5", name: "Closed", color: "#6b7280", order: 5 },
];

export const mockEmailTemplates: EmailTemplate[] = [
    { id: "et1", name: "Welcome Email", subject: "Welcome to ImmiVault", body: "Dear {client_name},\n\nWelcome to ImmiVault...", category: "Onboarding", updatedAt: "2026-01-15" },
    { id: "et2", name: "Case Update", subject: "Case Update – {case_title}", body: "Dear {client_name},\n\nYour case has been updated...", category: "Case Management", updatedAt: "2026-02-01" },
    { id: "et3", name: "Invoice Reminder", subject: "Invoice {invoice_number} – Payment Reminder", body: "Dear {client_name},\n\nThis is a reminder...", category: "Billing", updatedAt: "2026-01-20" },
    { id: "et4", name: "Appointment Confirmation", subject: "Appointment Confirmed – {date}", body: "Dear {client_name},\n\nYour appointment has been confirmed...", category: "Appointments", updatedAt: "2026-02-10" },
];

export const mockAutomationRules: AutomationRule[] = [
    { id: "ar1", name: "Auto-assign new cases", trigger: "Case Created", condition: "Visa Type = H-1B", action: "Assign to Sarah Chen", status: "active", createdAt: "2026-01-01" },
    { id: "ar2", name: "Send invoice reminder", trigger: "Invoice Due Date – 3 days", condition: "Status = Sent", action: "Send Reminder Email", status: "active", createdAt: "2026-01-15" },
    { id: "ar3", name: "Task overdue notification", trigger: "Task Due Date Passed", condition: "Status ≠ Done", action: "Send Notification to Assignee", status: "active", createdAt: "2026-02-01" },
];

export const mockBankAccounts: BankAccount[] = [
    { id: "ba1", bankName: "Chase Bank", accountName: "ImmiVault LLC – Operating", accountNumber: "****4521", routingNumber: "****0078", isDefault: true },
    { id: "ba2", bankName: "Bank of America", accountName: "ImmiVault LLC – Trust", accountNumber: "****7832", routingNumber: "****0134", isDefault: false },
];

export const mockBookingSettings: BookingSettings = {
    id: "bs1", slotDuration: 60, bufferTime: 15, availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], startTime: "09:00", endTime: "17:00", maxAdvanceBooking: 30,
};

export const mockCompanyProfile: CompanyProfile = {
    name: "ImmiVault LLC", email: "contact@immivault.com", phone: "+1-555-0100", address: "123 Immigration Ave, Suite 400, New York, NY 10001", website: "https://immivault.com",
};

// Dashboard stats
export const dashboardStats = {
    totalClients: mockClients.length,
    activeCases: mockCases.filter(c => c.stage !== "Closed").length,
    pendingTasks: mockTasks.filter(t => t.status !== "Done").length,
    monthlyRevenue: 15800,
    upcomingAppointments: mockAppointments.filter(a => a.status === "active").length,
    overdueInvoices: mockInvoices.filter(i => i.status === "Overdue").length,
};
