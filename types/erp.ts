// ============================================================
// FinRP — ERP Type Definitions
// ============================================================

export interface ERPMetrics {
  revenueMTD: number;
  revenueLastMonth: number;
  revenueGrowth: number;
  profit: number;
  profitMargin: number;
  cashFlow: number;
  workingCapitalRatio: number;
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalPayroll: number;
  inventoryValue: number;
}

export interface ERPOperations {
  billableHours: number;
  slaAdherence: number;
  projectOverrun: number;
  resourceAllocation: number;
}

export interface ERPAlert {
  id: string;
  type: "warning" | "danger" | "info";
  title: string;
  message: string;
  icon: string;
}

export interface ERPSuggestion {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: string;
}

export interface ERPProject {
  id: string;
  name: string;
  client: string;
  status: string;
  amount: number;
  progress: number;
  dueDate: string;
}

export interface ERPSale {
  id: string;
  saleNumber: string;
  customerId: string | null;
  totalAmount: number;
  status: string;
  saleDate: string;
  notes: string | null;
  customer?: { name: string } | null;
  items?: ERPSaleItem[];
}

export interface ERPSaleItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ERPPurchase {
  id: string;
  purchaseNumber: string;
  vendor: string;
  totalAmount: number;
  status: string;
  purchaseDate: string;
  notes: string | null;
}

export interface ERPExpense {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  vendor: string | null;
}

export interface ERPPayroll {
  id: string;
  employeeName: string;
  designation: string | null;
  salary: number;
  bonus: number;
  deductions: number;
  netPay: number;
  payPeriod: string;
}

export interface ERPDashboardData {
  metrics: ERPMetrics;
  operations: ERPOperations;
  alerts: ERPAlert[];
  suggestions: ERPSuggestion[];
  projects: ERPProject[];
  hasData: boolean;
}
