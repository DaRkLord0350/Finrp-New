"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  X,
  TrendingUp,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { useComplianceAuditLogs } from "@/hooks/useComplianceAuditLogs";
import { format } from "date-fns";
import type { ComplianceAuditLogRecord } from "@/types/compliance";

// ── Action metadata ───────────────────────────────────────────
const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  CREATED:           { label: "Created",          color: "#10b981", icon: "✦" },
  UPDATED:           { label: "Updated",          color: "#3b82f6", icon: "✎" },
  STATUS_CHANGED:    { label: "Status Changed",   color: "#f59e0b", icon: "⇄" },
  DOCUMENT_UPLOADED: { label: "Doc Uploaded",     color: "#6366f1", icon: "↑" },
  DOCUMENT_DELETED:  { label: "Doc Deleted",      color: "#ef4444", icon: "✕" },
  APPROVE:           { label: "Approved",         color: "#10b981", icon: "✓" },
  REJECT:            { label: "Rejected",         color: "#ef4444", icon: "✗" },
  REQUEST_CHANGES:   { label: "Changes Requested",color: "#f59e0b", icon: "↺" },
  ESCALATE:          { label: "Escalated",        color: "#8b5cf6", icon: "↑" },
  DELETED:           { label: "Deleted",          color: "#6b7280", icon: "⊗" },
};

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  ...Object.entries(ACTION_META).map(([value, { label }]) => ({ value, label })),
];

// ── Log Row ───────────────────────────────────────────────────
function LogRow({ log, index }: { log: ComplianceAuditLogRecord; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_META[log.action] ?? { label: log.action, color: "#6b7280", icon: "·" };

  const hasDetails =
    (log.oldValue && Object.keys(log.oldValue).length > 0) ||
    (log.newValue && Object.keys(log.newValue).length > 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      style={{
        borderBottom: "1px solid var(--border)",
        transition: "background 0.15s",
      }}
    >
      {/* Main row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "36px 1fr 140px 160px 120px",
          gap: 12,
          padding: "11px 16px",
          alignItems: "center",
          cursor: hasDetails ? "pointer" : "default",
        }}
        onClick={() => hasDetails && setExpanded((x) => !x)}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {/* Action icon */}
        <div
          style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: `${meta.color}14`, border: `1px solid ${meta.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, color: meta.color, fontWeight: 700,
          }}
        >
          {meta.icon}
        </div>

        {/* Description */}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {log.description}
          </p>
          {log.submissionId && (
            <Link
              href={`/compliance/submissions/${log.submissionId}`}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 11, color: "#6366f1", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 1 }}
            >
              <FileText size={9} /> View submission →
            </Link>
          )}
        </div>

        {/* Action badge */}
        <div>
          <span
            style={{
              fontSize: 10, fontWeight: 700, color: meta.color,
              background: `${meta.color}12`, border: `1px solid ${meta.color}25`,
              padding: "2px 8px", borderRadius: 99,
            }}
          >
            {meta.label}
          </span>
        </div>

        {/* Timestamp */}
        <div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {format(new Date(log.createdAt), "MMM d, yyyy")}
          </span>
          <br />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {format(new Date(log.createdAt), "h:mm a")}
          </span>
        </div>

        {/* IP address */}
        <div>
          {log.ipAddress ? (
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 6px" }}>
              {log.ipAddress}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasDetails && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          style={{ borderTop: "1px solid var(--border)", background: "var(--bg-elevated)", padding: "12px 16px 12px 64px" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {log.oldValue && Object.keys(log.oldValue).length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Before</p>
                <pre style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", margin: 0 }}>
                  {JSON.stringify(log.oldValue, null, 2)}
                </pre>
              </div>
            )}
            {log.newValue && Object.keys(log.newValue).length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>After</p>
                <pre style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", margin: 0 }}>
                  {JSON.stringify(log.newValue, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const { logs, pagination, loading, error, params, updateParams, refetch } =
    useComplianceAuditLogs({ pageSize: 30 });

  const handleSearch = () => updateParams({ action: actionFilter || undefined, page: 1 });

  // Action frequency for mini stats
  const actionCounts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.action] = (acc[l.action] ?? 0) + 1;
    return acc;
  }, {});

  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link href="/compliance" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>Compliance</Link>
            <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>Audit Logs</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Audit Trail</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
            {pagination.total} event{pagination.total !== 1 ? "s" : ""} recorded
          </p>
        </div>
        <button className="btn-ghost" onClick={refetch} style={{ padding: "8px 12px" }}>
          <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
        </button>
      </div>

      {/* Action frequency chips */}
      {topActions.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {topActions.map(([action, count]) => {
            const m = ACTION_META[action] ?? { label: action, color: "#6b7280" };
            return (
              <button
                key={action}
                onClick={() => { setActionFilter(action === actionFilter ? "" : action); updateParams({ action: action === actionFilter ? undefined : action }); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "4px 12px",
                  borderRadius: 99, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${actionFilter === action ? m.color : "var(--border)"}`,
                  background: actionFilter === action ? `${m.color}14` : "var(--bg-surface)",
                  color: actionFilter === action ? m.color : "var(--text-secondary)",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {m.label}
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  background: actionFilter === action ? m.color : "var(--bg-elevated)",
                  color: actionFilter === action ? "#fff" : "var(--text-muted)",
                  borderRadius: 99, padding: "0 5px", minWidth: 18, textAlign: "center",
                }}>
                  {count}
                </span>
              </button>
            );
          })}
          {actionFilter && (
            <button
              onClick={() => { setActionFilter(""); updateParams({ action: undefined }); }}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 99, fontSize: 12, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", cursor: "pointer" }}
            >
              <X size={11} /> Clear filter
            </button>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "12px 16px", flexWrap: "wrap",
        }}
      >
        <Filter size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />

        {/* Search by submission ID */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ color: "var(--text-muted)" }} />
          <input
            style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)", width: "100%" }}
            placeholder="Filter by submission ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                updateParams({ submissionId: search.trim() || undefined, page: 1 });
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); updateParams({ submissionId: undefined }); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: "var(--border)" }} />

        {/* Action filter */}
        <select
          className="input"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); updateParams({ action: e.target.value || undefined, page: 1 }); }}
          style={{ padding: "6px 10px", fontSize: 12, minWidth: 160 }}
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Page size */}
        <select
          className="input"
          value={params.pageSize ?? 30}
          onChange={(e) => updateParams({ pageSize: parseInt(e.target.value), page: 1 })}
          style={{ padding: "6px 10px", fontSize: 12, minWidth: 100 }}
        >
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>

        <button className="btn-brand" onClick={handleSearch} style={{ padding: "7px 14px", fontSize: 12 }}>
          Search
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "36px 1fr 140px 160px 120px",
            gap: 12,
            padding: "10px 16px",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
            fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}
        >
          <span />
          <span>Description</span>
          <span>Action</span>
          <span>Timestamp</span>
          <span>IP Address</span>
        </div>

        {loading ? (
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ height: 48, background: "var(--bg-elevated)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <ShieldAlert size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>No audit events found</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              {params.action || params.submissionId ? "Try adjusting your filters" : "Events will appear here as compliance actions occur"}
            </p>
          </div>
        ) : (
          logs.map((log, i) => <LogRow key={log.id} log={log} index={i} />)
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "0 4px" }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Showing {((pagination.page - 1) * pagination.pageSize) + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn-ghost"
              disabled={pagination.page <= 1}
              onClick={() => updateParams({ page: pagination.page - 1 })}
              style={{ padding: "6px 10px" }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ display: "flex", alignItems: "center", padding: "6px 12px", fontSize: 13, color: "var(--text-secondary)" }}>
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              className="btn-ghost"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateParams({ page: pagination.page + 1 })}
              style={{ padding: "6px 10px" }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
