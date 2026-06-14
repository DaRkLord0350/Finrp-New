"use client";

// ============================================================
// /erp/payroll — Payroll register, backed by the existing
// GET /api/erp/payroll route (tenant- and workspace-aware).
// ============================================================

import { format } from "date-fns";
import ErpModulePage, { inr, type ErpStat } from "@/components/erp/ErpModulePage";

export interface PayrollRow {
  id: string;
  employeeName: string;
  designation: string | null;
  department: string | null;
  payPeriod: string;
  grossPay: string | number;
  pf: string | number;
  esi: string | number;
  tax: string | number;
  otherDeductions: string | number;
  totalDeductions: string | number;
  netPay: string | number;
  paymentMethod: string;
  paidAt: string;
}

function buildStats(rows: PayrollRow[]): ErpStat[] {
  const gross = rows.reduce((s, r) => s + Number(r.grossPay), 0);
  const net = rows.reduce((s, r) => s + Number(r.netPay), 0);
  const tds = rows.reduce((s, r) => s + Number(r.tax), 0);
  return [
    { label: "Payroll Records", value: String(rows.length), color: "#6366f1" },
    { label: "Gross Pay", value: inr(gross), color: "#0ea5e9" },
    { label: "Net Pay", value: inr(net), color: "#10b981" },
    { label: "TDS Withheld", value: inr(tds), color: "#f59e0b" },
  ];
}

export default function PayrollPage() {
  return (
    <ErpModulePage<PayrollRow>
      title="Payroll"
      subtitle="Salary runs with deductions and TDS."
      fetchUrl="/api/erp/payroll"
      getId={(r) => r.id}
      buildStats={buildStats}
      searchPlaceholder="Search by employee, period…"
      searchFilter={(r, q) =>
        r.employeeName.toLowerCase().includes(q) ||
        r.payPeriod.toLowerCase().includes(q) ||
        (r.department ?? "").toLowerCase().includes(q)
      }
      emptyTitle="No payroll records yet"
      emptyHint="Payroll runs appear here as they are processed."
      columns={[
        {
          header: "Employee",
          render: (r) => (
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{r.employeeName}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {[r.designation, r.department].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          ),
        },
        {
          header: "Period",
          render: (r) => (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.payPeriod}</span>
          ),
        },
        {
          header: "Gross",
          align: "right",
          render: (r) => (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{inr(r.grossPay)}</span>
          ),
        },
        {
          header: "Deductions",
          align: "right",
          render: (r) => (
            <span style={{ fontSize: 13, color: "#f97316" }}>{inr(r.totalDeductions)}</span>
          ),
        },
        {
          header: "TDS",
          align: "right",
          render: (r) => (
            <span style={{ fontSize: 13, color: "#f59e0b" }}>{inr(r.tax)}</span>
          ),
        },
        {
          header: "Net Pay",
          align: "right",
          render: (r) => (
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#10b981" }}>{inr(r.netPay)}</span>
          ),
        },
        {
          header: "Paid",
          render: (r) => (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {format(new Date(r.paidAt), "dd MMM yyyy")}
            </span>
          ),
        },
      ]}
    />
  );
}
