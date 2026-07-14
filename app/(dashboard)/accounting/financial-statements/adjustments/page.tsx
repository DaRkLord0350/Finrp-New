"use client";

import { useState } from "react";
import { useQuery, queryClient } from "@/lib/queryCache";
import { formatCurrency } from "@/lib/formatters/currency";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
} from "lucide-react";

type AdjEntry = {
  id: string;
  accountId: string;
  scheduleKey: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  description?: string;
};

type AdjJournal = {
  id: string;
  journalNumber: string;
  description: string;
  entryDate: string;
  source: "AUDITOR" | "CA" | "MANAGEMENT";
  status: "DRAFT" | "POSTED";
  entries: AdjEntry[];
};

type Report = {
  id: string;
  statementType: string;
  periodStart: string;
  periodEnd: string;
};

const SOURCE_COLORS: Record<string, string> = {
  AUDITOR: "rgba(99,102,241,0.15)",
  CA: "rgba(16,185,129,0.15)",
  MANAGEMENT: "rgba(245,158,11,0.15)",
};
const SOURCE_TEXT: Record<string, string> = {
  AUDITOR: "#818cf8",
  CA: "#34d399",
  MANAGEMENT: "#fbbf24",
};

const emptyForm = {
  description: "",
  entryDate: new Date().toISOString().slice(0, 10),
  source: "CA" as "AUDITOR" | "CA" | "MANAGEMENT",
  entries: [{ accountId: "", scheduleKey: "", type: "DEBIT" as "DEBIT" | "CREDIT", amount: "" }],
};

export default function AdjustmentsPage() {
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [posting, setPosting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: reports, isLoading: reportsLoading } = useQuery<Report[]>(
    ["fs-reports-list"],
    async () => {
      const r = await fetch("/api/financial-statements/reports");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }
  );

  const { data: journals, isLoading: journalsLoading } = useQuery<AdjJournal[]>(
    ["fs-adjustments", selectedReportId],
    async () => {
      if (!selectedReportId) return [];
      const r = await fetch(`/api/financial-statements/adjustments?reportId=${selectedReportId}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    { enabled: !!selectedReportId }
  );

  async function postJournal(id: string) {
    setPosting(id);
    try {
      const r = await fetch(`/api/financial-statements/adjustments/${id}/post`, { method: "POST" });
      if (!r.ok) throw new Error("Failed to post");
      queryClient.invalidate(["fs-adjustments", selectedReportId]);
    } finally {
      setPosting(null);
    }
  }

  async function submitNewJournal() {
    if (!selectedReportId) return;
    setSubmitting(true);
    try {
      const body = {
        reportId: selectedReportId,
        description: form.description,
        entryDate: form.entryDate,
        source: form.source,
        entries: form.entries.map((e) => ({
          accountId: e.accountId,
          scheduleKey: e.scheduleKey,
          type: e.type,
          amount: parseFloat(String(e.amount)) || 0,
        })),
      };
      const r = await fetch("/api/financial-statements/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to create");
      queryClient.invalidate(["fs-adjustments", selectedReportId]);
      setShowForm(false);
      setForm(emptyForm);
    } finally {
      setSubmitting(false);
    }
  }

  function addEntryLine() {
    setForm((f) => ({
      ...f,
      entries: [...f.entries, { accountId: "", scheduleKey: "", type: "DEBIT", amount: "" }],
    }));
  }

  function removeEntryLine(i: number) {
    setForm((f) => ({ ...f, entries: f.entries.filter((_, idx) => idx !== i) }));
  }

  function updateEntry(i: number, field: string, value: string) {
    setForm((f) => ({
      ...f,
      entries: f.entries.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)),
    }));
  }

  const list = journals ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Adjustment Journals
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Non-destructive auditor adjustments applied on top of the GL.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={!selectedReportId}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            background: "#6366f1", color: "#fff", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: selectedReportId ? "pointer" : "not-allowed",
            opacity: selectedReportId ? 1 : 0.5,
          }}
        >
          <Plus size={14} /> New Adjustment
        </button>
      </div>

      {/* Important note banner */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
        borderRadius: 8, padding: "10px 14px", marginBottom: 20,
      }}>
        <AlertCircle size={16} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
          <strong style={{ color: "var(--text-primary)" }}>Note:</strong> Adjustment journals modify the statement view only. Source GL is never touched.
        </p>
      </div>

      {/* Report selector */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
          Report
        </label>
        {reportsLoading ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading reports…</div>
        ) : (
          <select
            value={selectedReportId}
            onChange={(e) => setSelectedReportId(e.target.value)}
            style={{
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "8px 12px", fontSize: 13,
              color: "var(--text-primary)", minWidth: 320,
            }}
          >
            <option value="">— Select a report —</option>
            {(reports ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.statementType} · {r.periodStart?.slice(0, 10)} → {r.periodEnd?.slice(0, 10)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Journal list */}
      {!selectedReportId ? (
        <div className="surface" style={{ padding: 40, textAlign: "center", borderRadius: 12 }}>
          <FileText size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Select a report to view its adjustment journals.</p>
        </div>
      ) : journalsLoading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading journals…</div>
      ) : list.length === 0 ? (
        <div className="surface" style={{ padding: 40, textAlign: "center", borderRadius: 12 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No adjustment journals yet. Create one to get started.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((j) => {
            const isExpanded = expandedId === j.id;
            return (
              <div key={j.id} className="surface" style={{ borderRadius: 10, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : j.id)}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", minWidth: 100 }}>
                    {j.journalNumber}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>{j.description}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{j.entryDate?.slice(0, 10)}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: SOURCE_COLORS[j.source], color: SOURCE_TEXT[j.source],
                  }}>
                    {j.source}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: j.status === "POSTED" ? "rgba(99,102,241,0.15)" : "rgba(16,185,129,0.15)",
                    color: j.status === "POSTED" ? "#818cf8" : "#34d399",
                  }}>
                    {j.status}
                  </span>
                  {j.status === "DRAFT" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); postJournal(j.id); }}
                      disabled={posting === j.id}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: "4px 10px",
                        background: "#6366f1", color: "#fff", border: "none",
                        borderRadius: 6, cursor: "pointer", opacity: posting === j.id ? 0.6 : 1,
                      }}
                    >
                      {posting === j.id ? "Posting…" : "Post Journal"}
                    </button>
                  )}
                </div>
                {isExpanded && j.entries && j.entries.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "0 16px 12px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
                      <thead>
                        <tr>
                          {["Account", "Schedule Key", "Type", "Amount"].map((h) => (
                            <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", padding: "4px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {j.entries.map((entry) => (
                          <tr key={entry.id} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "6px 8px", fontSize: 13, color: "var(--text-primary)" }}>{entry.accountId}</td>
                            <td style={{ padding: "6px 8px", fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>{entry.scheduleKey}</td>
                            <td style={{ padding: "6px 8px" }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                                background: entry.type === "DEBIT" ? "rgba(59,130,246,0.12)" : "rgba(16,185,129,0.12)",
                                color: entry.type === "DEBIT" ? "#60a5fa" : "#34d399",
                              }}>
                                {entry.type}
                              </span>
                            </td>
                            <td style={{ padding: "6px 8px", fontSize: 13, color: "var(--text-primary)", textAlign: "right" }}>
                              {formatCurrency(entry.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Adjustment Modal */}
      {showForm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div className="surface" style={{ width: 620, maxHeight: "90vh", overflowY: "auto", borderRadius: 14, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>New Adjustment Journal</h2>
              <button onClick={() => { setShowForm(false); setForm(emptyForm); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Year-end depreciation adjustment"
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)" }}
                />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Entry Date</label>
                  <input
                    type="date"
                    value={form.entryDate}
                    onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Source</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as typeof form.source }))}
                    style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)" }}
                  >
                    <option value="CA">CA</option>
                    <option value="AUDITOR">Auditor</option>
                    <option value="MANAGEMENT">Management</option>
                  </select>
                </div>
              </div>

              {/* Entry lines */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Journal Lines</label>
                  <button onClick={addEntryLine} style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add Line</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.entries.map((entry, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 1fr 28px", gap: 6, alignItems: "center" }}>
                      <input
                        placeholder="Account ID"
                        value={entry.accountId}
                        onChange={(e) => updateEntry(i, "accountId", e.target.value)}
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--text-primary)" }}
                      />
                      <input
                        placeholder="Schedule key"
                        value={entry.scheduleKey}
                        onChange={(e) => updateEntry(i, "scheduleKey", e.target.value)}
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--text-primary)", fontFamily: "monospace" }}
                      />
                      <select
                        value={entry.type}
                        onChange={(e) => updateEntry(i, "type", e.target.value)}
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px", fontSize: 12, color: "var(--text-primary)" }}
                      >
                        <option value="DEBIT">Dr</option>
                        <option value="CREDIT">Cr</option>
                      </select>
                      <input
                        placeholder="Amount"
                        type="number"
                        value={entry.amount}
                        onChange={(e) => updateEntry(i, "amount", e.target.value)}
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "var(--text-primary)" }}
                      />
                      {form.entries.length > 1 && (
                        <button onClick={() => removeEntryLine(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={() => { setShowForm(false); setForm(emptyForm); }}
                  style={{ padding: "8px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitNewJournal}
                  disabled={submitting || !form.description}
                  style={{
                    padding: "8px 20px", background: "#6366f1", color: "#fff",
                    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: submitting || !form.description ? "not-allowed" : "pointer",
                    opacity: submitting || !form.description ? 0.6 : 1,
                  }}
                >
                  {submitting ? "Creating…" : "Create Journal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
