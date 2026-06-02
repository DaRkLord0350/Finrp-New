"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  RefreshCw,
  Filter,
  AlertTriangle,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

interface Settlement {
  id: string;
  amount: number;
  settlementDate: string;
  status: string;
  utr: string | null;
  notes: string | null;
  createdAt: string;
  tredsInvoice: {
    id: string;
    invoiceNumber: string;
    buyerName: string;
    invoiceAmount: number;
    financierName: string | null;
  };
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED:  "bg-amber-500/20 text-amber-400",
  PROCESSING: "bg-blue-500/20 text-blue-400",
  PAID:       "bg-emerald-500/20 text-emerald-400",
  FAILED:     "bg-red-500/20 text-red-400",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "PAID") return <CheckCircle2 size={13} color="#10b981" />;
  if (status === "FAILED") return <XCircle size={13} color="#ef4444" />;
  return <Clock size={13} color="#f59e0b" />;
}

function Skeleton() {
  return (
    <tr>
      <td colSpan={7}>
        <div style={{ height: 42, background: "var(--bg-elevated)", margin: "3px 0", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
      </td>
    </tr>
  );
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
];

export default function TredsSettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (statusFilter) p.set("status", statusFilter);
      const res = await fetch(`/api/treds/settlements?${p}`);
      if (!res.ok) throw new Error("Failed to load settlements");
      const data = await res.json();
      setSettlements(data.settlements ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Summary stats
  const paid = settlements.filter((s) => s.status === "PAID");
  const totalPaid = paid.reduce((s, i) => s + i.amount, 0);
  const pending = settlements.filter((s) => s.status === "SCHEDULED" || s.status === "PROCESSING");

  function exportCSV() {
    if (!settlements.length) return;
    const headers = ["Invoice #", "Buyer", "Financier", "Amount", "Settlement Date", "UTR", "Status"];
    const rows = settlements.map((s) => [
      s.tredsInvoice.invoiceNumber,
      s.tredsInvoice.buyerName,
      s.tredsInvoice.financierName ?? "",
      s.amount,
      format(new Date(s.settlementDate), "yyyy-MM-dd"),
      s.utr ?? "",
      s.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `treds-settlements-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("CSV exported");
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Settlements</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
            {loading ? "Loading..." : `${total} settlement${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={load} style={{ padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <RefreshCw size={13} />
            Refresh
          </button>
          <button className="btn-ghost" onClick={exportCSV} style={{ padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total Settled", value: `₹${(totalPaid / 100000).toFixed(2)}L`, icon: CheckCircle2, color: "#10b981" },
          { label: "Pending Settlement", value: String(pending.length), icon: Clock, color: "#f59e0b" },
          { label: "Total Transactions", value: String(total), icon: Wallet, color: "#6366f1" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            className="stat-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${s.color}18`, border: `1px solid ${s.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={15} color={s.color} strokeWidth={1.75} />
              </div>
            </div>
            <p style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <Filter size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <select
            className="input"
            style={{ paddingLeft: 30, paddingRight: 28, appearance: "none", cursor: "pointer", minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <motion.div
        className="surface"
        style={{ overflow: "hidden" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Buyer</th>
                <th>Financier</th>
                <th>Amount</th>
                <th>Settlement Date</th>
                <th>UTR</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(6)].map((_, i) => <Skeleton key={i} />)
                : settlements.length === 0
                ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "56px 24px", textAlign: "center" }}>
                      <Wallet size={40} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
                      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No settlements found</p>
                    </td>
                  </tr>
                )
                : settlements.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/customer/treds/invoices/${s.tredsInvoice.id}`} style={{ color: "#818cf8", textDecoration: "none", fontFamily: "monospace", fontSize: 13 }}>
                        {s.tredsInvoice.invoiceNumber}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{s.tredsInvoice.buyerName}</td>
                    <td style={{ fontSize: 12 }}>{s.tredsInvoice.financierName ?? "—"}</td>
                    <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>₹{Number(s.amount).toLocaleString("en-IN")}</td>
                    <td style={{ fontSize: 12 }}>{format(new Date(s.settlementDate), "dd MMM yyyy")}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{s.utr ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <StatusIcon status={s.status} />
                        <span className={`badge ${STATUS_COLORS[s.status] ?? ""}`} style={{ border: "none", fontSize: 10 }}>
                          {s.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
