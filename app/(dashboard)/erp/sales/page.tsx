"use client";

// ============================================================
// /erp/sales — Sales register, backed by the existing
// GET /api/erp/sales route (tenant- and workspace-aware).
// ============================================================

import { format } from "date-fns";
import ErpModulePage, { inr, type ErpStat } from "@/components/erp/ErpModulePage";

interface SaleRow {
  id: string;
  saleNumber: string;
  totalAmount: string | number;
  taxAmount: string | number;
  profit: string | number;
  status: "COMPLETED" | "PENDING" | "RETURNED" | "CANCELLED";
  paymentStatus: string;
  saleDate: string;
  channel: string | null;
  customer: { name: string; company: string | null } | null;
  items: { id: string }[];
}

const statusColors: Record<SaleRow["status"], { color: string; bg: string }> = {
  COMPLETED: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  PENDING:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  RETURNED:  { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  CANCELLED: { color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

function buildStats(rows: SaleRow[]): ErpStat[] {
  const active = rows.filter((r) => r.status !== "CANCELLED" && r.status !== "RETURNED");
  const revenue = active.reduce((s, r) => s + Number(r.totalAmount), 0);
  const profit = active.reduce((s, r) => s + Number(r.profit), 0);
  const pending = rows.filter((r) => r.status === "PENDING").length;
  return [
    { label: "Total Sales", value: String(rows.length), color: "#6366f1" },
    { label: "Revenue", value: inr(revenue), color: "#10b981" },
    { label: "Profit", value: inr(profit), color: "#0ea5e9" },
    { label: "Pending", value: String(pending), color: "#f59e0b" },
  ];
}

export default function SalesPage() {
  return (
    <ErpModulePage<SaleRow>
      title="Sales"
      subtitle="Every sale recorded for this organization."
      fetchUrl="/api/erp/sales"
      getId={(r) => r.id}
      buildStats={buildStats}
      searchPlaceholder="Search by number, customer…"
      searchFilter={(r, q) =>
        r.saleNumber.toLowerCase().includes(q) ||
        (r.customer?.name ?? "").toLowerCase().includes(q) ||
        (r.customer?.company ?? "").toLowerCase().includes(q)
      }
      emptyTitle="No sales recorded yet"
      emptyHint="Sales appear here as they are recorded in the ERP module."
      columns={[
        {
          header: "Sale",
          render: (r) => (
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{r.saleNumber}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {format(new Date(r.saleDate), "dd MMM yyyy")}
              </p>
            </div>
          ),
        },
        {
          header: "Customer",
          render: (r) => (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {r.customer?.company ?? r.customer?.name ?? "Walk-in"}
            </span>
          ),
        },
        {
          header: "Items",
          render: (r) => (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.items.length}</span>
          ),
        },
        {
          header: "Amount",
          align: "right",
          render: (r) => (
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
              {inr(r.totalAmount)}
            </span>
          ),
        },
        {
          header: "Profit",
          align: "right",
          render: (r) => (
            <span style={{ fontSize: 13, color: Number(r.profit) >= 0 ? "#10b981" : "#ef4444" }}>
              {inr(r.profit)}
            </span>
          ),
        },
        {
          header: "Status",
          render: (r) => {
            const s = statusColors[r.status] ?? statusColors.PENDING;
            return (
              <span
                className="badge"
                style={{ background: s.bg, color: s.color, borderColor: `${s.color}30`, fontSize: 11 }}
              >
                {r.status}
              </span>
            );
          },
        },
        {
          header: "Payment",
          render: (r) => (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.paymentStatus}</span>
          ),
        },
      ]}
    />
  );
}
