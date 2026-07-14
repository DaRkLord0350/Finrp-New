"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw, Plus, Download, CheckCircle2, AlertTriangle,
  Send, Lock, ThumbsUp, Sparkles, SlidersHorizontal, X,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";

type ReportStatus = "DRAFT" | "REVIEW" | "APPROVED" | "LOCKED" | "PUBLISHED";

interface Report {
  id: string;
  name: string;
  status: ReportStatus;
  periodStart: string;
  periodEnd: string;
  comparativePeriodStart?: string;
  comparativePeriodEnd?: string;
  category: string;
}

interface SectionRow {
  label: string;
  currentAmount: number;
  comparativeAmount?: number;
  noteRef?: number;
  indent?: number;
  bold?: boolean;
  italic?: boolean;
  borderTop?: boolean;
}

interface ReportSection {
  key: string;
  title: string;
  rows: SectionRow[];
  subtotal?: SectionRow;
  total?: SectionRow;
}

interface SnapshotData {
  report: Report;
  sections: ReportSection[];
  balanceCheck: { balanced: boolean; assetsTotal: number; liabEquityTotal: number; difference: number };
  computedAt: string;
}

const STATUS_COLOR: Record<ReportStatus, { fg: string; bg: string }> = {
  DRAFT:     { fg: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
  REVIEW:    { fg: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  APPROVED:  { fg: "#10b981", bg: "rgba(16,185,129,0.12)" },
  LOCKED:    { fg: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  PUBLISHED: { fg: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
};

function StatusBadge({ status }: { status: ReportStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: c.fg, background: c.bg, padding: "3px 10px", borderRadius: 6 }}>{status}</span>
  );
}

export default function BalanceSheetPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch("/api/financial-statements/reports?type=BALANCE_SHEET");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      const list: Report[] = json.reports ?? json ?? [];
      setReports(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoadingReports(false);
    }
  }, [selectedId]);

  const loadSnapshot = useCallback(async (id: string, refresh = false) => {
    if (!id) return;
    setLoadingSnapshot(true);
    setError(null);
    try {
      const res = await fetch(`/api/financial-statements/reports/${id}/snapshot${refresh ? "?refresh=true" : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load snapshot");
      setSnapshot(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load snapshot");
    } finally {
      setLoadingSnapshot(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);
  useEffect(() => { if (selectedId) loadSnapshot(selectedId); }, [selectedId, loadSnapshot]);

  const doAction = async (action: string) => {
    if (!selectedId) return;
    setActionBusy(action);
    setError(null);
    try {
      const statusMap: Record<string, string> = {
        review: "REVIEW", approve: "APPROVED", lock: "LOCKED",
      };
      if (action === "validate") {
        const res = await fetch(`/api/financial-statements/reports/${selectedId}/validate`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Validation failed");
        await loadSnapshot(selectedId, false);
        return;
      }
      const newStatus = statusMap[action];
      if (newStatus) {
        const res = await fetch(`/api/financial-statements/reports/${selectedId}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Action failed");
        await loadReports();
        await loadSnapshot(selectedId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionBusy(null);
    }
  };

  const report = snapshot?.report;
  const sections = snapshot?.sections ?? [];
  const bal = snapshot?.balanceCheck;

  const comparativeMode = !!report?.comparativePeriodStart;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Balance Sheet</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 3 }}>Schedule III — Statement of Financial Position</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {loadingReports ? (
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading reports…</span>
          ) : (
            <select value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)}
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 12px", fontSize: 13, cursor: "pointer", maxWidth: 260 }}>
              <option value="">— Select Report —</option>
              {reports.map((r) => <option key={r.id} value={r.id}>{r.name || `BS ${new Date(r.periodStart).getFullYear()}`}</option>)}
            </select>
          )}
          <button onClick={() => selectedId && loadSnapshot(selectedId, true)} disabled={loadingSnapshot || !selectedId} className="btn-ghost" style={{ padding: "8px 12px" }}>
            <RefreshCw size={15} style={loadingSnapshot ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px" }}>
            <Plus size={14} /> New Report
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Status bar */}
      {report && (
        <div className="surface" style={{ padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <StatusBadge status={report.status} />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {new Date(report.periodStart).toLocaleDateString("en-IN")} — {new Date(report.periodEnd).toLocaleDateString("en-IN")}
          </span>
          {comparativeMode && (
            <span style={{ fontSize: 11, color: "#6366f1", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: 5 }}>
              Comparative Period Included
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {report.status === "DRAFT" && (
              <button onClick={() => doAction("review")} disabled={!!actionBusy} className="btn-ghost"
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px", opacity: actionBusy ? 0.6 : 1 }}>
                <Send size={12} /> Submit for Review
              </button>
            )}
            {report.status === "REVIEW" && (
              <button onClick={() => doAction("approve")} disabled={!!actionBusy} className="btn-ghost"
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px", color: "#10b981", opacity: actionBusy ? 0.6 : 1 }}>
                <ThumbsUp size={12} /> Approve
              </button>
            )}
            {report.status === "APPROVED" && (
              <button onClick={() => doAction("lock")} disabled={!!actionBusy} className="btn-ghost"
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px", color: "#6366f1", opacity: actionBusy ? 0.6 : 1 }}>
                <Lock size={12} /> Lock
              </button>
            )}
          </div>
        </div>
      )}

      {/* Balance check banner */}
      {bal && (
        <div style={{ padding: "10px 16px", marginBottom: 16, borderRadius: 8, border: `1px solid ${bal.balanced ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, background: bal.balanced ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          {bal.balanced ? <CheckCircle2 size={16} color="#10b981" /> : <AlertTriangle size={16} color="#ef4444" />}
          <span style={{ fontSize: 13, color: bal.balanced ? "#10b981" : "#ef4444", fontWeight: 600 }}>
            {bal.balanced ? "Balance Sheet balances" : "Balance Sheet does not balance"}
          </span>
          {!bal.balanced && (
            <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 4 }}>
              Assets {formatCurrency(bal.assetsTotal)} ≠ Liabilities + Equity {formatCurrency(bal.liabEquityTotal)} (difference {formatCurrency(bal.difference)})
            </span>
          )}
        </div>
      )}

      {/* Main report table */}
      {loadingSnapshot ? (
        <div className="surface" style={{ padding: 60, textAlign: "center" }}>
          <div style={{ display: "inline-block", width: 28, height: 28, border: "2px solid var(--border)", borderTopColor: "var(--brand-400)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12 }}>Computing balance sheet…</p>
        </div>
      ) : !selectedId ? (
        <div className="surface" style={{ padding: 60, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Select a report above or create a new Balance Sheet report.</p>
        </div>
      ) : sections.length === 0 ? (
        <div className="surface" style={{ padding: 60, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No data yet. Run ledger mapping first or refresh.</p>
        </div>
      ) : (
        <motion.div className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ overflow: "hidden", marginBottom: 72 }}>
          {/* Column header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px" + (comparativeMode ? " 180px" : ""), padding: "10px 20px", borderBottom: "2px solid var(--border-strong)", background: "var(--bg-elevated)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Particulars</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>
              {report ? `As of ${new Date(report.periodEnd).toLocaleDateString("en-IN")}` : "Current Year"}
            </div>
            {comparativeMode && (
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>
                {report?.comparativePeriodEnd ? new Date(report.comparativePeriodEnd).toLocaleDateString("en-IN") : "Prior Year"}
              </div>
            )}
          </div>

          {sections.map((section) => (
            <div key={section.key}>
              {/* Section header */}
              <div style={{ padding: "12px 20px 4px", background: "rgba(99,102,241,0.04)", borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{section.title}</span>
              </div>
              {/* Rows */}
              {section.rows.map((row, i) => (
                <ReportRow key={i} row={row} comparative={comparativeMode} />
              ))}
              {/* Subtotal */}
              {section.subtotal && (
                <ReportRow row={{ ...section.subtotal, italic: true }} comparative={comparativeMode} />
              )}
              {/* Total */}
              {section.total && (
                <ReportRow row={{ ...section.total, bold: true, borderTop: true }} comparative={comparativeMode} />
              )}
            </div>
          ))}
        </motion.div>
      )}

      {/* Sticky bottom toolbar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--bg-surface)", borderTop: "1px solid var(--border)", padding: "12px 24px", display: "flex", gap: 10, zIndex: 40, flexWrap: "wrap" }}>
        <button onClick={() => doAction("validate")} disabled={!!actionBusy || !selectedId} className="btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, opacity: !selectedId ? 0.5 : 1 }}>
          <CheckCircle2 size={14} /> {actionBusy === "validate" ? "Validating…" : "Validate"}
        </button>
        <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Download size={14} /> Export PDF
        </button>
        <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Download size={14} /> Export Excel
        </button>
        <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <SlidersHorizontal size={14} /> Add Adjustment
        </button>
        <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Sparkles size={14} color="#a78bfa" /> AI Review
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {snapshot?.computedAt && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Computed {new Date(snapshot.computedAt).toLocaleTimeString("en-IN")}
            </span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function ReportRow({ row, comparative }: { row: SectionRow; comparative: boolean }) {
  const indent = row.indent ?? 0;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `1fr 180px${comparative ? " 180px" : ""}`,
      padding: `8px 20px 8px ${20 + indent * 20}px`,
      borderTop: row.borderTop ? "2px solid var(--border-strong)" : "1px solid var(--border)",
      background: row.bold ? "var(--bg-elevated)" : undefined,
    }}>
      <div style={{ fontSize: 13, fontWeight: row.bold ? 700 : 400, fontStyle: row.italic ? "italic" : undefined, color: row.bold ? "var(--text-primary)" : "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
        {row.label}
        {row.noteRef !== undefined && (
          <sup style={{ fontSize: 10, color: "#6366f1", fontWeight: 600 }}>[{row.noteRef}]</sup>
        )}
      </div>
      <div style={{ textAlign: "right", fontSize: 13, fontWeight: row.bold ? 700 : 400, fontStyle: row.italic ? "italic" : undefined, color: row.bold ? "var(--text-primary)" : "var(--text-secondary)" }}>
        {formatCurrency(row.currentAmount)}
      </div>
      {comparative && (
        <div style={{ textAlign: "right", fontSize: 13, fontWeight: row.bold ? 700 : 400, fontStyle: row.italic ? "italic" : undefined, color: "var(--text-muted)" }}>
          {row.comparativeAmount !== undefined ? formatCurrency(row.comparativeAmount) : "—"}
        </div>
      )}
    </div>
  );
}
