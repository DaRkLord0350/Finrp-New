// ============================================
// FinRP — Core TypeScript Types
// ============================================

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
export type ComplianceCategory = "TAX" | "REGULATORY" | "LICENSE" | "AUDIT" | "REPORTING" | "OTHER";
export type UserRole = "ADMIN" | "MANAGER" | "STAFF" | "VIEWER";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CREDIT_CARD" | "ONLINE" | "OTHER";
export type Plan = "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  notes?: string | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    invoices: number;
  };
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  organizationId: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer?: Customer;
  items?: InvoiceItem[];
}

export interface Payment {
  id: string;
  invoiceId: string;
  organizationId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  paidAt: Date;
  createdAt: Date;
}

export interface ComplianceTask {
  id: string;
  title: string;
  description?: string | null;
  category: ComplianceCategory;
  status: TaskStatus;
  dueDate: Date;
  completedAt?: Date | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  revenueGrowth: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalCustomers: number;
  newCustomersThisMonth: number;
  avgDealSize: number;
  monthlyRevenue: MonthlyRevenue[];
  topCustomers: TopCustomer[];
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  invoices: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  company?: string | null;
  totalRevenue: number;
  invoiceCount: number;
}

export interface AdvisorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Form types
export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
}

export interface CreateInvoiceInput {
  customerId: string;
  dueDate: string;
  taxRate?: number;
  notes?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface CreateComplianceTaskInput {
  title: string;
  description?: string;
  category: ComplianceCategory;
  dueDate: string;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Analytics
export interface MonthlyRevenue {
  month: string;
  revenue: number;
  invoices: number;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  revenueGrowth: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalCustomers: number;
  avgDealSize: number;
  monthlyRevenue: MonthlyRevenue[];
}


