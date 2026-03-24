// ============================================================
// ImmiVault — Core TypeScript Types
// ============================================================

export type Status = "active" | "inactive" | "pending" | "archived";
export type CaseStage = "New" | "In Progress" | "Under Review" | "Approved" | "Closed";
export type TaskStatus = "To Do" | "In Progress" | "Review" | "Done";
export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue";
export type PaymentStatus = "Completed" | "Pending" | "Failed" | "Refunded";
export type Priority = "Low" | "Medium" | "High" | "Urgent";
export type AppointmentType = "Consultation" | "Document Review" | "Interview Prep" | "Follow-up" | "Other";

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  nationality: string;
  visaType: string;
  status: Status;
  createdAt: string;
  avatar?: string;
}

export interface Case {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  visaType: string;
  stage: CaseStage;
  assignedTo: string;
  priority: Priority;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  caseId?: string;
  caseName?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  clientId: string;
  clientName: string;
  status: Status;
  uploadedAt: string;
  expiryDate?: string;
  fileSize: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  type: AppointmentType;
  date: string;
  time: string;
  duration: string;
  location: string;
  notes: string;
  status: Status;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  items: InvoiceItem[];
  totalAmount: number;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
  notes: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  id: string;
  invoiceId?: string;
  clientId: string;
  clientName: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  date: string;
  reference: string;
}

export interface PaymentLink {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  description: string;
  link: string;
  status: Status;
  expiryDate: string;
  createdAt: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: Status;
  avatar?: string;
  joinedAt: string;
}

export interface CaseStageConfig {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  isDefault: boolean;
}

export interface CompanyProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  logo?: string;
}
