"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Download,
  RefreshCw,
  AlertTriangle,
  FileText,
  Users,
  Landmark,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type ReportType = "funding" | "aging" | "buyer" | "financier";

const REPORT_TABS: { value: ReportType; label: string; icon: typeof BarChart3; desc: string }[] = [
  { value: "funding",   label: "Funding Report",     icon: Landmark,  desc: "Summary of funded invoices and financing rates" },
  { value: "aging",     label: "Invoice Aging",       icon: Calendar,  desc: "Overdue and aging analysis of active invoices" },
  { value: "buyer",     label: "Buyer Performance",   icon: Users,     desc: "Approval rates and timelines by buyer" },
  { value: "financier", label: "Financier Analysis",  icon: BarChart3, desc: "Bid acceptance rates and funding volumes by institution" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportRow = Record<string, any>;

function Skeleton({ height = 40 }: { height?: number }) {
  return (
    <tr>
      <td colSpan={8}>
        <div style={{ height, background: "var(--bg-elevated)", borderRadius: 6, margin: "3px 0", animation: "pulse 1.5s ease-in-out infinite" }} />
      </td>
    </tr>
  );
}

function FundingTable({ rows }: { rows: ReportRow[] }) {
  return (
    <table className="data-table" style={{ minWidth: 800 }}>
      <thead>
        <tr>
          <th>Invoice #</th>
          <th>Buyer</th>
          <th>Invoice Amount</th>
          <th>Funded Amount</th>
          <th>Financier</th>
          <th>Rate (% p.a.)</th>
          <th>Funded On</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ fontFamily: "monospace", color: "#818cf8" }}>{r.invoiceNumber}</td>
            <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.buyerName}</td>
            <td>₹{Number(r.invoiceAmount).toLocaleString("en-IN")}</td>
            <td style={{ fontWeight: 700, color: "#10b981" }}>₹{Number(r.fundingAmount).toLocaleString("en-IN")}</td>
            <td>{r.financierName}</td>
            <td>{r.financingRate !== null ? `${Number(r.financingRate).toFixed(3)}%` : "—"}</td>
            <td style={{ fontSize: 12 }}>{r.fundedAt ? format(new Date(r.fundedAt), "dd MMM yyyy") : "—"}</td>
            <td>
              <span className="badge bg-emerald-500/20 text-emerald-400" style={{ border: "none", fontSize: 10 }}>{r.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AgingTable({ rows }: { rows: ReportRow[] }) {
  return (
    <table className="data-table" style={{ minWidth: 700 }}>
      <thead>
        <tr>
          <th>Invoice #</th>
          <th>Buyer</th>
          <th>Amount</th>
          <th>Due Date</th>
          <th>Days Overdue</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ fontFamily: "monospace", color: "#818cf8" }}>{r.invoiceNumber}</td>
            <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.buyerName}</td>
            <td>₹{Number(r.invoiceAmount).toLocaleString("en-IN")}</td>
            <td style={{ fontSize: 12 }}>{format(new Date(r.dueDate), "dd MMM yyyy")}</td>
            <td>
              <span
                style={{
                  fontWeight: 700,
                  color: r.daysOverdue > 30 ? "#ef4444" : r.daysOverdue > 0 ? "#f59e0b" : "#10b981",
                }}
              >
                {r.daysOverdue > 0 ? `${r.daysOverdue} days` : "On time"}
              </span>
            </td>
            <td>
              <span className="badge bg-zinc-500/20 text-zinc-400" style={{ border: "none", fontSize: 10 }}>{r.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BuyerTable({ rows }: { rows: ReportRow[] }) {
  return (
    <table className="data-table" style={{ minWidth: 700 }}>
      <thead>
        <tr>
          <th>Buyer</th>
          <th>Total Invoices</th>
          <th>Approved</th>
          <th>Rejected</th>
          <th>Pending</th>
          <th>Avg Approval (days)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.buyerName}</td>
            <td>{r.totalInvoices}</td>
            <td style={{ color: "#10b981", fontWeight: 600 }}>{r.approved}</td>
            <td style={{ color: "#ef4444" }}>{r.rejected}</td>
            <td style={{ color: "#f59e0b" }}>{r.pending}</td>
            <td>{r.avgApprovalDays !== null ? `${r.avgApprovalDays}d` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FinancierTable({ rows }: { rows: ReportRow[] }) {
  return (
    <table className="data-table" style={{ minWidth: 700 }}>
      <thead>
        <tr>
          <th>Financier</th>
          <th>Total Bids</th>
          <th>Accepted</th>
          <th>Total Funded</th>
          <th>Avg Rate (% p.a.)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.financierName}</td>
            <td>{r.totalBids}</td>
            <td style={{ color: "#10b981", fontWeight: 600 }}>{r.acceptedBids}</td>
            <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>₹{Number(r.totalFunded).toLocaleString("en-IN")}</td>
            <td>{r.avgRate !== null ? `${Number(r.avgRate).toFixed(3)}%` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function TredsReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportType>("funding");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/treds/reports?type=${activeTab}`);
      if (!res.ok) throw new Error("Failed to load report");
      const data = await res.json();
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  function exportCSV() {
    if (!rows.length) { toast.error("No data to export"); return; }
    const headers = Object.keys(rows[0]);
    const csvRows = rows.map((r) => headers.map((h) => {
      const v = r[h];
      if (v instanceof Date || (typeof v === "string" && v.includes("T"))) {
        try { return format(new Date(v), "yyyy-MM-dd"); } catch { return v; }
      }
      return v ?? "";
    }));
    const csv = [headers, ...csvRows].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `treds-${activeTab}-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Report exported");
  }

  const activeTabDef = REPORT_TABS.find((t) => t.value === activeTab)!;

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Reports</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
            {activeTabDef.desc}
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

      {/* Tab Strip */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                borderRadius: 9,
                border: `1px solid ${activeTab === tab.value ? "rgba(99,102,241,0.5)" : "var(--border)"}`,
                background: activeTab === tab.value ? "rgba(99,102,241,0.1)" : "transparent",
                color: activeTab === tab.value ? "#818cf8" : "var(--text-secondary)",
                fontSize: 13,
                fontWeight: activeTab === tab.value ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <motion.div
        key={activeTab}
        className="surface"
        style={{ overflow: "hidden" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <table className="data-table" style={{ minWidth: 700 }}>
              <tbody>{[...Array(6)].map((_, i) => <Skeleton key={i} />)}</tbody>
            </table>
          ) : rows.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center" }}>
              <FileText size={40} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No data available for this report.</p>
            </div>
          ) : activeTab === "funding" ? (
            <FundingTable rows={rows} />
          ) : activeTab === "aging" ? (
            <AgingTable rows={rows} />
          ) : activeTab === "buyer" ? (
            <BuyerTable rows={rows} />
          ) : (
            <FinancierTable rows={rows} />
          )}
        </div>
      </motion.div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
