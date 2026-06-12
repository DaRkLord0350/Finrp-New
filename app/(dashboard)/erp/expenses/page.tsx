"use client";

// ============================================================
// /erp/expenses — Expense register, backed by the existing
// GET /api/erp/expenses route (tenant- and workspace-aware).
// ============================================================

import { format } from "date-fns";
import ErpModulePage, { inr, type ErpStat } from "@/components/erp/ErpModulePage";

interface ExpenseRow {
  id: string;
  category: string;
  description: string;
  amount: string | number;
  taxAmount: string | number;
  vendorName: string | null;
  department: string | null;
  recurring: boolean;
  recurringFrequency: string | null;
  expenseDate: string;
}

const categoryColors: Record<string, string> = {
  RENT: "#f59e0b",
  UTILITIES: "#0ea5e9",
  SALARIES: "#6366f1",
  MARKETING: "#ec4899",
  TRAVEL: "#a78bfa",
  SOFTWARE: "#38bdf8",
  EQUIPMENT: "#f97316",
  LOGISTICS: "#14b8a6",
  MAINTENANCE: "#84cc16",
  OPERATIONS: "#10b981",
  TAXES: "#ef4444",
  OTHER: "#64748b",
};

function buildStats(rows: ExpenseRow[]): ErpStat[] {
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const now = new Date();
  const monthTotal = rows
    .filter((r) => {
      const d = new Date(r.expenseDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, r) => s + Number(r.amount), 0);
  const recurring = rows.filter((r) => r.recurring).length;
  const categories = new Set(rows.map((r) => r.category)).size;
  return [
    { label: "Total Expenses", value: inr(total), color: "#ef4444" },
    { label: "This Month", value: inr(monthTotal), color: "#f59e0b" },
    { label: "Recurring", value: String(recurring), color: "#6366f1" },
    { label: "Categories", value: String(categories), color: "#0ea5e9" },
  ];
}

export default function ExpensesPage() {
  return (
    <ErpModulePage<ExpenseRow>
      title="Expenses"
      subtitle="Operational spend across all categories."
      fetchUrl="/api/erp/expenses"
      getId={(r) => r.id}
      buildStats={buildStats}
      searchPlaceholder="Search by description, vendor…"
      searchFilter={(r, q) =>
        r.description.toLowerCase().includes(q) ||
        (r.vendorName ?? "").toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      }
      emptyTitle="No expenses recorded yet"
      emptyHint="Expenses appear here as they are recorded in the ERP module."
      columns={[
        {
          header: "Expense",
          render: (r) => (
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{r.description}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {format(new Date(r.expenseDate), "dd MMM yyyy")}
              </p>
            </div>
          ),
        },
        {
          header: "Category",
          render: (r) => {
            const color = categoryColors[r.category] ?? categoryColors.OTHER;
            return (
              <span
                className="badge"
                style={{
                  background: `${color}1f`,
                  color,
                  borderColor: `${color}30`,
                  fontSize: 11,
                  textTransform: "capitalize",
                }}
              >
                {r.category.toLowerCase()}
              </span>
            );
          },
        },
        {
          header: "Vendor",
          render: (r) => (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.vendorName ?? "—"}</span>
          ),
        },
        {
          header: "Department",
          render: (r) => (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.department ?? "—"}</span>
          ),
        },
        {
          header: "Amount",
          align: "right",
          render: (r) => (
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
              {inr(r.amount)}
            </span>
          ),
        },
        {
          header: "Recurring",
          render: (r) => (
            <span style={{ fontSize: 12, color: r.recurring ? "#10b981" : "var(--text-muted)" }}>
              {r.recurring ? (r.recurringFrequency ?? "Yes") : "—"}
            </span>
          ),
        },
      ]}
    />
  );
}
