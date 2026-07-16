"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useQuery } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

interface AccountRow {
  id: string;
  accountNumber: string;
  status: string;
  principalDisbursed: string;
  currentOutstandingPrincipal: string;
  nextDueDate: string | null;
  nextDueAmount: string | null;
  customer: { name: string };
  product: { name: string };
}

function fmt(v: unknown) {
  const n = Number(v);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function LoanAccountsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const { data, isLoading } = useQuery<{ items: AccountRow[]; total: number }>(["lending", "accounts", search, status], async () => {
    const sp = new URLSearchParams();
    if (search) sp.set("search", search);
    if (status !== "All") sp.set("status", status);
    const res = await fetch(`/api/lending/accounts?${sp.toString()}`);
    if (!res.ok) throw new Error("Failed to load loan accounts");
    return res.json();
  });

  const items = data?.items ?? [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Loan Accounts</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>{data?.total ?? 0} account{data?.total === 1 ? "" : "s"}</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 260px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by account # or customer…" style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", fontSize: 13 }} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", fontSize: 13 }}>
          {["All", "ACTIVE", "CLOSED", "FORECLOSED", "WRITTEN_OFF", "NPA_SUBSTANDARD", "NPA_DOUBTFUL", "NPA_LOSS", "DEFAULTED"].map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", background: "var(--bg-base)" }}>
              <th style={{ padding: "10px 16px" }}>Account</th>
              <th style={{ padding: "10px 16px" }}>Customer</th>
              <th style={{ padding: "10px 16px" }}>Product</th>
              <th style={{ padding: "10px 16px" }}>Outstanding</th>
              <th style={{ padding: "10px 16px" }}>Next Due</th>
              <th style={{ padding: "10px 16px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>}
            {!isLoading && items.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No loan accounts yet.</td></tr>}
            {items.map((a) => (
              <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px" }}>
                  <Link href={`/lending/accounts/${a.id}`} style={{ color: "#818cf8", fontWeight: 600, textDecoration: "none" }}>{a.accountNumber}</Link>
                </td>
                <td style={{ padding: "12px 16px" }}>{a.customer.name}</td>
                <td style={{ padding: "12px 16px" }}>{a.product.name}</td>
                <td style={{ padding: "12px 16px" }}>{fmt(a.currentOutstandingPrincipal)}</td>
                <td style={{ padding: "12px 16px" }}>{a.nextDueDate ? `${new Date(a.nextDueDate).toLocaleDateString("en-IN")} · ${fmt(a.nextDueAmount ?? 0)}` : "—"}</td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
