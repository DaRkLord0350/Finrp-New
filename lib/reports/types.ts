// ============================================================
// Report Engine — Shared Types
// ============================================================

export type ReportCategory =
  | "business_overview"
  | "sales"
  | "inventory"
  | "inventory_valuation"
  | "receivables"
  | "payments_received"
  | "recurring_invoices"
  | "payables"
  | "purchases_expenses"
  | "taxes"
  | "banking"
  | "projects_timesheet"
  | "accountant"
  | "budgets"
  | "currency"
  | "activity"
  | "automation";

export interface ReportDefinition {
  id: string;
  slug: string;
  category: ReportCategory;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
}

export type DatePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "custom";

export interface ReportFilters {
  datePreset?: DatePreset;
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
  vendorId?: string;
  itemId?: string;
  status?: string;
  currency?: string;
  accountId?: string;
}

export interface ReportResult<T = unknown> {
  slug: string;
  name: string;
  generatedAt: string;
  filters: ReportFilters;
  summary?: Record<string, number | string>;
  columns: ReportColumn[];
  rows: T[];
  totals?: Record<string, number>;
  charts?: ReportChart[];
}

export interface ReportColumn {
  key: string;
  label: string;
  type: "text" | "number" | "currency" | "date" | "percent" | "badge";
  align?: "left" | "right" | "center";
  sortable?: boolean;
}

export interface ReportChart {
  type: "bar" | "line" | "pie" | "area";
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKeys: string[];
}

// ── AR / AP Aging buckets ─────────────────────────────────────────────────────
export interface AgingBucket {
  label: string;
  min: number; // days overdue (inclusive)
  max: number; // days overdue (exclusive, -1 = no limit)
}

export const AR_AGING_BUCKETS: AgingBucket[] = [
  { label: "Current",    min: 0,   max: 1  },
  { label: "1–30 days",  min: 1,   max: 31 },
  { label: "31–60 days", min: 31,  max: 61 },
  { label: "61–90 days", min: 61,  max: 91 },
  { label: "> 90 days",  min: 91,  max: -1 },
];

export const AP_AGING_BUCKETS = AR_AGING_BUCKETS;
