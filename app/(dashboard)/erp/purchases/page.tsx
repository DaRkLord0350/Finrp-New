"use client";

// ============================================================
// /erp/purchases — Procurement register, backed by the existing
// GET /api/erp/purchases route (tenant- and workspace-aware).
// ============================================================

import { format } from "date-fns";
import ErpModulePage, { inr, type ErpStat } from "@/components/erp/ErpModulePage";

interface PurchaseRow {
  id: string;
  purchaseNumber: string;
  vendorName: string | null;
  totalAmount: string | number;
  taxAmount: string | number;
  status: "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  paymentStatus: string;
  purchaseType: string | null;
  expectedDelivery: string | null;
  purchaseDate: string;
}

const statusColors: Record<PurchaseRow["status"], { color: string; bg: string; label: string }> = {
  ORDERED:            { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Ordered" },
  PARTIALLY_RECEIVED: { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)", label: "Partial" },
  RECEIVED:           { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Received" },
  CANCELLED:          { color: "#64748b", bg: "rgba(100,116,139,0.12)", label: "Cancelled" },
};

function buildStats(rows: PurchaseRow[]): ErpStat[] {
  const active = rows.filter((r) => r.status !== "CANCELLED");
  const spend = active.reduce((s, r) => s + Number(r.totalAmount), 0);
  const open = rows.filter((r) => r.status === "ORDERED" || r.status === "PARTIALLY_RECEIVED").length;
  const received = rows.filter((r) => r.status === "RECEIVED").length;
  return [
    { label: "Total Purchases", value: String(rows.length), color: "#6366f1" },
    { label: "Total Spend", value: inr(spend), color: "#0ea5e9" },
    { label: "Open Orders", value: String(open), color: "#f59e0b" },
    { label: "Received", value: String(received), color: "#10b981" },
  ];
}

export default function PurchasesPage() {
  return (
    <ErpModulePage<PurchaseRow>
      title="Purchases"
      subtitle="Procurement orders and vendor purchases."
      fetchUrl="/api/erp/purchases"
      getId={(r) => r.id}
      buildStats={buildStats}
      searchPlaceholder="Search by number, vendor…"
      searchFilter={(r, q) =>
        r.purchaseNumber.toLowerCase().includes(q) ||
        (r.vendorName ?? "").toLowerCase().includes(q)
      }
      emptyTitle="No purchases recorded yet"
      emptyHint="Purchase orders appear here as they are recorded in the ERP module."
      columns={[
        {
          header: "Purchase",
          render: (r) => (
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{r.purchaseNumber}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {format(new Date(r.purchaseDate), "dd MMM yyyy")}
              </p>
            </div>
          ),
        },
        {
          header: "Vendor",
          render: (r) => (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.vendorName ?? "—"}</span>
          ),
        },
        {
          header: "Type",
          render: (r) => (
            <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "capitalize" }}>
              {r.purchaseType ?? "—"}
            </span>
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
          header: "Status",
          render: (r) => {
            const s = statusColors[r.status] ?? statusColors.ORDERED;
            return (
              <span
                className="badge"
                style={{ background: s.bg, color: s.color, borderColor: `${s.color}30`, fontSize: 11 }}
              >
                {s.label}
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
        {
          header: "Expected",
          render: (r) => (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {r.expectedDelivery ? format(new Date(r.expectedDelivery), "dd MMM yyyy") : "—"}
            </span>
          ),
        },
      ]}
    />
  );
}
