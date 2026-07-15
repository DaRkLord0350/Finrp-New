"use client";

import { useState } from "react";
import {
  History, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useBankSyncHistory } from "@/hooks/useBankSyncHistory";

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  SUCCESS: { bg: "rgba(16,185,129,0.1)",  text: "#10b981", icon: <CheckCircle2 size={11} /> },
  PARTIAL: { bg: "rgba(245,158,11,0.1)",  text: "#f59e0b", icon: <AlertTriangle size={11} /> },
  FAILED:  { bg: "rgba(239,68,68,0.1)",   text: "#ef4444", icon: <XCircle size={11} /> },
  RUNNING: { bg: "rgba(99,102,241,0.1)",  text: "#818cf8", icon: <Loader2 size={11} className="animate-spin" /> },
  QUEUED:  { bg: "rgba(100,116,139,0.1)", text: "#64748b", icon: <Clock size={11} /> },
};

const TRIGGER_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SCHEDULED: "Scheduled",
  WEBHOOK: "Webhook",
  INITIAL: "Initial",
};

const FILTERS = ["ALL", "SUCCESS", "PARTIAL", "FAILED", "RUNNING"] as const;

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function SyncHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { runs, isLoading, error } = useBankSyncHistory(
    statusFilter === "ALL" ? undefined : { status: statusFilter }
  );

  const successCount = runs.filter(r => r.status === "SUCCESS").length;
  const failedCount = runs.filter(r => r.status === "FAILED").length;
  const totalSaved = runs.reduce((s, r) => s + r.txnsSaved, 0);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <History size={20} color="#6366f1" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Sync History</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Every bank data sync run — trigger, outcome, and failure detail</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                border: statusFilter === f ? "1px solid #6366f1" : "1px solid var(--border)",
                background: statusFilter === f ? "rgba(99,102,241,0.1)" : "var(--bg-card)",
                color: statusFilter === f ? "#6366f1" : "var(--text-muted)",
              }}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {!isLoading && runs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            { label: "Runs Shown", value: runs.length, color: "#6366f1" },
            { label: "Successful", value: successCount, color: "#10b981" },
            { label: "Failed", value: failedCount, color: "#ef4444" },
            { label: "Transactions Saved", value: totalSaved, color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
              <p style={{ fontSize: 22, fontWeight: 700, color }}>{value}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertTriangle size={13} color="#ef4444" />
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Failed to load sync history. Refresh to retry.</p>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 56, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />)}
        </div>
      ) : runs.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={28} color="#6366f1" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No sync runs yet</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>
              Connect a bank via Account Aggregator and sync runs will show up here with full detail.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Started", "Account", "Trigger", "Type", "Status", "Saved", "Duplicates", "Duration", "Error"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(run => {
                const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.QUEUED;
                return (
                  <tr key={run.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatDateTime(run.startedAt)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{run.bankAccount?.bankName ?? "All accounts"}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{run.bankAccount?.maskedNumber ?? ""}</p>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{TRIGGER_LABELS[run.trigger] ?? run.trigger}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{run.syncType}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: cfg.bg, color: cfg.text }}>
                        {cfg.icon} {run.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: run.txnsSaved > 0 ? "#10b981" : "var(--text-muted)" }}>{run.txnsSaved}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" }}>{run.txnsDuplicate}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{formatDuration(run.durationMs)}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#ef4444", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={run.error ?? undefined}>
                      {run.error ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
