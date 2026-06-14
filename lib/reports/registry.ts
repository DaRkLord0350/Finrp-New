// ============================================================
// Report Registry — single source of truth for all reports.
// UI pages are generated from this list — no hardcoded lists.
// ============================================================

import type { ReportDefinition } from "./types";

export const REPORTS: ReportDefinition[] = [
  // ── Business Overview ──────────────────────────────────────────────────────
  {
    id: "profit-loss",
    slug: "profit-loss",
    category: "business_overview",
    name: "Profit & Loss",
    description: "Income vs expenses summary for a given period",
    icon: "TrendingUp",
    enabled: true,
  },
  {
    id: "cash-flow",
    slug: "cash-flow",
    category: "business_overview",
    name: "Cash Flow Statement",
    description: "Operating, investing, and financing cash movements",
    icon: "Droplets",
    enabled: true,
  },
  {
    id: "sales-summary",
    slug: "sales-summary",
    category: "business_overview",
    name: "Sales Summary",
    description: "Overview of all sales activity by period",
    icon: "ShoppingCart",
    enabled: true,
  },

  // ── Sales ──────────────────────────────────────────────────────────────────
  {
    id: "sales-by-customer",
    slug: "sales-by-customer",
    category: "sales",
    name: "Sales by Customer",
    description: "Revenue breakdown per customer",
    icon: "Users",
    enabled: true,
  },
  {
    id: "sales-by-item",
    slug: "sales-by-item",
    category: "sales",
    name: "Sales by Item",
    description: "Revenue breakdown per product or service",
    icon: "Package",
    enabled: true,
  },

  // ── Receivables ───────────────────────────────────────────────────────────
  {
    id: "ar-aging",
    slug: "ar-aging",
    category: "receivables",
    name: "AR Aging Summary",
    description: "Outstanding receivables grouped by age",
    icon: "Clock",
    enabled: true,
  },
  {
    id: "customer-balance",
    slug: "customer-balance",
    category: "receivables",
    name: "Customer Balance Summary",
    description: "Outstanding balance per customer",
    icon: "Wallet",
    enabled: true,
  },
  {
    id: "receivable-summary",
    slug: "receivable-summary",
    category: "receivables",
    name: "Receivable Summary",
    description: "Total invoiced, collected, and outstanding",
    icon: "Receipt",
    enabled: true,
  },

  // ── Payables ──────────────────────────────────────────────────────────────
  {
    id: "ap-aging",
    slug: "ap-aging",
    category: "payables",
    name: "AP Aging Summary",
    description: "Outstanding payables to vendors grouped by age",
    icon: "AlertCircle",
    enabled: true,
  },
  {
    id: "vendor-balance",
    slug: "vendor-balance",
    category: "payables",
    name: "Vendor Balance Summary",
    description: "Outstanding balance per vendor",
    icon: "Building2",
    enabled: true,
  },

  // ── Accountant ────────────────────────────────────────────────────────────
  {
    id: "trial-balance",
    slug: "trial-balance",
    category: "accountant",
    name: "Trial Balance",
    description: "All accounts with debit and credit totals",
    icon: "Scale",
    enabled: true,
  },
  {
    id: "general-ledger",
    slug: "general-ledger",
    category: "accountant",
    name: "General Ledger",
    description: "All journal entries by account",
    icon: "BookOpen",
    enabled: true,
  },

  // ── Activity ──────────────────────────────────────────────────────────────
  {
    id: "activity-logs",
    slug: "activity-logs",
    category: "activity",
    name: "Activity Logs & Audit Trail",
    description: "All user actions and system events",
    icon: "Activity",
    enabled: true,
  },
];

export const REPORT_CATEGORIES: Record<string, { label: string; icon: string }> = {
  business_overview:    { label: "Business Overview",        icon: "LayoutDashboard" },
  sales:                { label: "Sales",                    icon: "ShoppingCart"    },
  inventory:            { label: "Inventory",                icon: "Boxes"           },
  inventory_valuation:  { label: "Inventory Valuation",      icon: "DollarSign"      },
  receivables:          { label: "Receivables",              icon: "ArrowDownCircle" },
  payments_received:    { label: "Payments Received",        icon: "CircleCheck"     },
  recurring_invoices:   { label: "Recurring Invoices",       icon: "RefreshCw"       },
  payables:             { label: "Payables",                 icon: "ArrowUpCircle"   },
  purchases_expenses:   { label: "Purchases & Expenses",     icon: "ShoppingBag"     },
  taxes:                { label: "Taxes",                    icon: "Percent"         },
  banking:              { label: "Banking",                  icon: "Landmark"        },
  projects_timesheet:   { label: "Projects & Timesheet",     icon: "FolderOpen"      },
  accountant:           { label: "Accountant",               icon: "BookOpen"        },
  budgets:              { label: "Budgets",                  icon: "PiggyBank"       },
  currency:             { label: "Currency",                 icon: "Globe"           },
  activity:             { label: "Activity",                 icon: "Activity"        },
  automation:           { label: "Automation",               icon: "Zap"             },
};

export function getReport(slug: string): ReportDefinition | undefined {
  return REPORTS.find((r) => r.slug === slug);
}

export function getReportsByCategory(category: string): ReportDefinition[] {
  return REPORTS.filter((r) => r.category === category && r.enabled);
}
