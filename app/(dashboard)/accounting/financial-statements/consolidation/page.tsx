"use client";

import { useState } from "react";
import { useQuery, queryClient } from "@/lib/queryCache";
import { Layers, Plus, X, ChevronDown, ChevronRight } from "lucide-react";

type ConsolidationRun = {
  id: string;
  statementType: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "PROCESSING" | "COMPLETED" | "FAILED";
  childOrganizationIds: string[];
  consolidatedData?: Record<string, unknown>;
  createdAt: string;
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  DRAFT:      { bg: "rgba(156,163,175,0.15)", text: "#9ca3af" },
  PROCESSING: { bg: "rgba(245,158,11,0.15)",  text: "#fbbf24" },
  COMPLETED:  { bg: "rgba(16,185,129,0.15)",  text: "#34d399" },
  FAILED:     { bg: "rgba(239,68,68,0.15)",   text: "#f87171" },
};

const STATEMENT_TYPES = ["BALANCE_SHEET", "PROFIT_LOSS", "CASH_FLOW"];

const emptyForm = {
  statementType: "BALANCE_SHEET",
  periodStart: "",
  periodEnd: "",
  childIds: "",
};

export default function ConsolidationPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: runs, isLoading } = useQuery<ConsolidationRun[]>(
    ["fs-consolidation"],
    async () => {
      const r = await fetch("/api/financial-statements/consolidation");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }
  );

  async function submitConsolidation() {
    setSubmitting(true);
    try {
      const childOrganizationIds = form.childIds
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await fetch("/api/financial-statements/consolidation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementType: form.statementType,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          childOrganizationIds,
        }),
      });
      if (!r.ok) throw new Error("Failed to create consolidation");
      queryClient.invalidate(["fs-consolidation"]);
      setShowForm(false);
      setForm(emptyForm);
    } finally {
      setSubmitting(false);
    }
  }

  const list = runs ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 920, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Branch Consolidation
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Consolidate financial statements across multiple entities.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            background: "#6366f1", color: "#fff", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Plus size={14} /> New Consolidation
        </button>
      </div>

      {/* Note banner */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 8, padding: "10px 14px", marginBottom: 20,
      }}>
        <Layers size={14} style={{ color: "#818cf8", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
          Consolidation uses the same AccountScheduleMap for all entities. Ensure all child organisations share an identical schedule structure.
        </p>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading consolidations…</div>
      ) : list.length === 0 ? (
        <div className="surface" style={{ padding: 40, textAlign: "center", borderRadius: 12 }}>
          <Layers size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No consolidation runs yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((run) => {
            const isExpanded = expandedId === run.id;
            const ss = STATUS_STYLE[run.status] ?? STATUS_STYLE.DRAFT;
            return (
              <div key={run.id} className="surface" style={{ borderRadius: 10, overflow: "hidden" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}
                  onClick={() => setExpandedId(isExpanded ? null : run.id)}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", minWidth: 140 }}>
                    {run.statementType.replace("_", " ")}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {run.periodStart?.slice(0, 10)} → {run.periodEnd?.slice(0, 10)}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {run.childOrganizationIds?.length ?? 0} child org{(run.childOrganizationIds?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: ss.bg, color: ss.text,
                  }}>
                    {run.status}
                  </span>
                </div>
                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                      Child Organisations
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: run.consolidatedData ? 14 : 0 }}>
                      {(run.childOrganizationIds ?? []).map((cid) => (
                        <span key={cid} style={{
                          fontSize: 12, fontFamily: "monospace", padding: "2px 8px",
                          background: "var(--bg-elevated)", border: "1px solid var(--border)",
                          borderRadius: 6, color: "var(--text-secondary)",
                        }}>
                          {cid}
                        </span>
                      ))}
                    </div>
                    {run.consolidatedData && run.status === "COMPLETED" && (
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 8px" }}>
                          Consolidated Data
                        </p>
                        <pre style={{
                          fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)",
                          background: "var(--bg-elevated)", borderRadius: 8, padding: 12,
                          overflowX: "auto", margin: 0, maxHeight: 240,
                        }}>
                          {JSON.stringify(run.consolidatedData, null, 2)}
                        </pre>
                      </div>
                    )}
                    {run.status === "FAILED" && (
                      <p style={{ fontSize: 13, color: "#f87171", marginTop: 8 }}>
                        Consolidation failed. Please retry or check child organisation data.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Consolidation Modal */}
      {showForm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div className="surface" style={{ width: 520, borderRadius: 14, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>New Consolidation</h2>
              <button onClick={() => { setShowForm(false); setForm(emptyForm); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Statement Type</label>
                <select
                  value={form.statementType}
                  onChange={(e) => setForm((f) => ({ ...f, statementType: e.target.value }))}
                  style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)" }}
                >
                  {STATEMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Period Start</label>
                  <input
                    type="date"
                    value={form.periodStart}
                    onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Period End</label>
                  <input
                    type="date"
                    value={form.periodEnd}
                    onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Child Organisation IDs <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(one per line)</span>
                </label>
                <textarea
                  value={form.childIds}
                  onChange={(e) => setForm((f) => ({ ...f, childIds: e.target.value }))}
                  placeholder={"org_abc123\norg_def456"}
                  rows={5}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    borderRadius: 8, padding: "8px 12px", fontSize: 12,
                    color: "var(--text-primary)", fontFamily: "monospace", resize: "vertical",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => { setShowForm(false); setForm(emptyForm); }}
                  style={{ padding: "8px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitConsolidation}
                  disabled={submitting || !form.periodStart || !form.periodEnd || !form.childIds.trim()}
                  style={{
                    padding: "8px 20px", background: "#6366f1", color: "#fff",
                    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? "Creating…" : "Start Consolidation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
