"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Download, Plus } from "lucide-react";
import { useQuery } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

interface ApplicationRow {
  id: string;
  applicationNumber: string;
  status: string;
  stage: string;
  requestedAmount: string;
  requestedTenureMonths: number;
  createdAt: string;
  customer: { name: string };
  product: { name: string };
}

const STATUS_OPTIONS = [
  "All", "DRAFT", "IN_PROGRESS", "ON_HOLD", "APPROVED", "CONDITIONALLY_APPROVED",
  "REJECTED", "WITHDRAWN", "SANCTIONED", "DISBURSED", "ACTIVE", "CLOSED", "FORECLOSED", "DEFAULTED",
];

function formatINR(v: string | number) {
  const n = Number(v);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function LendingApplicationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const { data, isLoading } = useQuery<{ items: ApplicationRow[]; total: number }>(
    ["lending", "applications", search, status],
    async () => {
      const sp = new URLSearchParams();
      if (search) sp.set("search", search);
      if (status !== "All") sp.set("status", status);
      const res = await fetch(`/api/lending/applications?${sp.toString()}`);
      if (!res.ok) throw new Error("Failed to load applications");
      return res.json();
    }
  );

  const items = data?.items ?? [];

  const handleExport = () => {
    const headers = ["Application #", "Customer", "Product", "Amount", "Tenure (months)", "Status", "Stage", "Created"];
    const rows = items.map((a) => [
      a.applicationNumber,
      a.customer.name,
      a.product.name,
      Number(a.requestedAmount),
      a.requestedTenureMonths,
      a.status,
      a.stage,
      new Date(a.createdAt).toISOString().slice(0, 10),
    ]);
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Loan Applications</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{data?.total ?? 0} application{data?.total === 1 ? "" : "s"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleExport}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}
          >
            <Download size={14} /> Export
          </button>
          <Link
            href="/lending/applications/new"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#6366f1", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            <Plus size={15} /> New Application
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 260px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by application # or customer…"
            style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", fontSize: 13, color: "var(--text-primary)" }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", fontSize: 13, color: "var(--text-primary)" }}
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", background: "var(--bg-base)" }}>
              <th style={{ padding: "10px 16px" }}>Application</th>
              <th style={{ padding: "10px 16px" }}>Customer</th>
              <th style={{ padding: "10px 16px" }}>Product</th>
              <th style={{ padding: "10px 16px" }}>Amount</th>
              <th style={{ padding: "10px 16px" }}>Stage</th>
              <th style={{ padding: "10px 16px" }}>Status</th>
              <th style={{ padding: "10px 16px" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No applications found.</td></tr>
            )}
            {items.map((a) => (
              <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px" }}>
                  <Link href={`/lending/applications/${a.id}`} style={{ color: "#818cf8", fontWeight: 600, textDecoration: "none" }}>
                    {a.applicationNumber}
                  </Link>
                </td>
                <td style={{ padding: "12px 16px" }}>{a.customer.name}</td>
                <td style={{ padding: "12px 16px" }}>{a.product.name}</td>
                <td style={{ padding: "12px 16px" }}>{formatINR(a.requestedAmount)}</td>
                <td style={{ padding: "12px 16px" }}>{a.stage.replace(/_/g, " ")}</td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={a.status} /></td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{new Date(a.createdAt).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
