"use client";

import { motion } from "framer-motion";
import { Plus, Search, Download, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatCurrency, getInvoiceStatusColor } from "@/lib/utils";
import { useInvoices } from "@/hooks/useInvoices";
import { format } from "date-fns";

const statusOptions = ["All", "DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];

export default function BillingPage() {
  const { invoices, loading, error, refetch, stats } = useInvoices();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = invoices.filter((inv) => {
    const matchSearch =
      (inv.customer?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredRevenue = filtered
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + Number(i.total), 0);
  const filteredOutstanding = filtered
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((s, i) => s + Number(i.total), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Billing</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>Manage invoices, track payments, and monitor outstanding balances.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={refetch} style={{ padding: "8px 12px" }}>
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button className="btn-ghost"><Download size={14} /> Export</button>
          <Link href="/billing/new" className="btn-brand">
            <Plus size={15} /> New Invoice
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 20 }}>
          {error} — <button onClick={refetch} style={{ color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* Summary strips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Invoices", value: loading ? "—" : filtered.length.toString(), color: "#6366f1" },
          { label: "Paid", value: loading ? "—" : filtered.filter(i => i.status === "PAID").length.toString(), color: "#10b981" },
          { label: "Outstanding", value: loading ? "—" : formatCurrency(filteredOutstanding), color: "#3b82f6" },
          { label: "Overdue", value: loading ? "—" : filtered.filter(i => i.status === "OVERDUE").length.toString(), color: "#ef4444" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            style={{ padding: "16px 18px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{item.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", background: statusFilter === s ? "rgba(99,102,241,0.15)" : "transparent", borderColor: statusFilter === s ? "rgba(99,102,241,0.4)" : "var(--border)", color: statusFilter === s ? "#818cf8" : "var(--text-secondary)", transition: "all 0.15s ease" }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      <motion.div
        className="surface"
        style={{ overflow: "hidden" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
            Loading invoices…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            {search || statusFilter !== "All" ? "No invoices match your filters." : "No invoices yet."}{" "}
            {!search && statusFilter === "All" && <Link href="/billing/new" style={{ color: "#818cf8" }}>Create one →</Link>}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} style={{ cursor: "pointer" }}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{inv.invoiceNumber}</span>
                  </td>
                  <td>
                    <div>
                      <p style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: 14 }}>{inv.customer?.name ?? "—"}</p>
                      <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{inv.customer?.email ?? ""}</p>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{formatCurrency(Number(inv.total))}</span>
                  </td>
                  <td>
                    <span className={`badge ${getInvoiceStatusColor(inv.status)}`}>{inv.status}</span>
                  </td>
                  <td style={{ fontSize: 13 }}>{format(new Date(inv.issueDate), "MMM d, yyyy")}</td>
                  <td style={{ fontSize: 13 }}>{format(new Date(inv.dueDate), "MMM d, yyyy")}</td>
                  <td>
                    <Link href={`/billing/${inv.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#818cf8", textDecoration: "none" }}>
                      View <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
