"use client";

// ============================================================
// /erp/vendors — Vendor register, backed by /api/erp/vendors.
// Vendor is the source of truth for TBX beneficiary linkage — the
// TBX Linked column here is a quick-glance summary; full lifecycle
// actions (Create/Verify/Sync) live on the vendor detail page.
// ============================================================

import Link from "next/link";
import ErpModulePage, { type ErpStat } from "@/components/erp/ErpModulePage";

interface VendorRow {
  id: string;
  name: string;
  vendorCode: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  outstandingBalance: string | number;
  isActive: boolean;
  tbxBeneficiaryStatus: "NOT_LINKED" | "PENDING" | "ACTIVE" | "INACTIVE" | "FAILED";
  tbxApprovalStatus: "NOT_REQUESTED" | "PENDING" | "APPROVED" | "REJECTED";
}

const beneficiaryColors: Record<VendorRow["tbxBeneficiaryStatus"], { color: string; bg: string; label: string }> = {
  NOT_LINKED: { color: "#64748b", bg: "rgba(100,116,139,0.12)", label: "Not Linked" },
  PENDING:    { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Pending" },
  ACTIVE:     { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "TBX Linked" },
  INACTIVE:   { color: "#64748b", bg: "rgba(100,116,139,0.12)", label: "Inactive" },
  FAILED:     { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Failed" },
};

function buildStats(rows: VendorRow[]): ErpStat[] {
  const active = rows.filter((r) => r.isActive);
  const linked = rows.filter((r) => r.tbxBeneficiaryStatus === "ACTIVE");
  const outstanding = rows.reduce((s, r) => s + Number(r.outstandingBalance), 0);
  return [
    { label: "Total Vendors", value: String(rows.length), color: "#6366f1" },
    { label: "Active", value: String(active.length), color: "#10b981" },
    { label: "TBX Linked", value: String(linked.length), color: "#0ea5e9" },
    { label: "Outstanding", value: `₹${outstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "#f59e0b" },
  ];
}

export default function VendorsPage() {
  return (
    <ErpModulePage<VendorRow>
      title="Vendors"
      subtitle="Supplier register and TBX beneficiary linkage for vendor-bill payments."
      fetchUrl="/api/erp/vendors"
      getId={(r) => r.id}
      buildStats={buildStats}
      searchPlaceholder="Search by name, code, GSTIN…"
      searchFilter={(r, q) =>
        r.name.toLowerCase().includes(q) ||
        (r.vendorCode ?? "").toLowerCase().includes(q) ||
        (r.gstin ?? "").toLowerCase().includes(q)
      }
      emptyTitle="No vendors yet"
      emptyHint="Vendors appear here once added, and can be recorded directly against Purchases."
      columns={[
        {
          header: "Vendor",
          render: (r) => (
            <Link href={`/erp/vendors/${r.id}`} style={{ textDecoration: "none" }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{r.name}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{r.vendorCode ?? r.gstin ?? "—"}</p>
            </Link>
          ),
        },
        {
          header: "Contact",
          render: (r) => (
            <div>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{r.email ?? "—"}</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{r.phone ?? ""}</p>
            </div>
          ),
        },
        {
          header: "TBX Status",
          render: (r) => {
            const s = beneficiaryColors[r.tbxBeneficiaryStatus] ?? beneficiaryColors.NOT_LINKED;
            return (
              <span className="badge" style={{ background: s.bg, color: s.color, borderColor: `${s.color}30`, fontSize: 11 }}>
                {s.label}
              </span>
            );
          },
        },
        {
          header: "Outstanding",
          align: "right",
          render: (r) => (
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
              ₹{Number(r.outstandingBalance).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
          ),
        },
        {
          header: "Status",
          render: (r) => (
            <span
              className="badge"
              style={{
                background: r.isActive ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)",
                color: r.isActive ? "#10b981" : "#64748b",
                border: "none",
                fontSize: 11,
              }}
            >
              {r.isActive ? "Active" : "Inactive"}
            </span>
          ),
        },
      ]}
    />
  );
}
