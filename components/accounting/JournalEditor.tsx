"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAccountOptions } from "@/hooks/useChartOfAccounts";
import { formatCurrency } from "@/lib/formatters/currency";
import type { CreateJournalPayload, JournalDetail } from "@/hooks/useJournals";

interface EditorLine {
  key: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

interface JournalEditorProps {
  initial?: JournalDetail;
  mode: "create" | "edit";
  submitting?: boolean;
  onSubmit: (payload: CreateJournalPayload, post: boolean) => Promise<void>;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  padding: "8px 10px",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500,
  marginBottom: 6,
  display: "block",
};

let keySeq = 0;
const newKey = () => `l${keySeq++}`;

function toISODate(d: string | Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function JournalEditor({ initial, mode, submitting, onSubmit, onCancel }: JournalEditorProps) {
  const { options } = useAccountOptions(true);

  // Accounts that are parents (have children) cannot be posted to.
  const parentIds = useMemo(
    () => new Set(options.map((o) => o.parentAccountId).filter(Boolean) as string[]),
    [options]
  );

  const [entryDate, setEntryDate] = useState(initial ? toISODate(initial.entryDate) : toISODate(new Date()));
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<EditorLine[]>(() => {
    if (initial?.lines?.length) {
      return initial.lines.map((l) => ({
        key: newKey(),
        accountId: l.accountId,
        debit: l.type === "DEBIT" ? String(Number(l.amount)) : "",
        credit: l.type === "CREDIT" ? String(Number(l.amount)) : "",
        description: l.description ?? "",
      }));
    }
    return [
      { key: newKey(), accountId: "", debit: "", credit: "", description: "" },
      { key: newKey(), accountId: "", debit: "", credit: "", description: "" },
    ];
  });
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      debit += Number(l.debit) || 0;
      credit += Number(l.credit) || 0;
    }
    return { debit, credit, diff: Math.round((debit - credit) * 100) / 100 };
  }, [lines]);

  const balanced = Math.abs(totals.diff) < 0.005 && totals.debit > 0;

  const updateLine = (key: string, patch: Partial<EditorLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((prev) => [...prev, { key: newKey(), accountId: "", debit: "", credit: "", description: "" }]);
  const removeLine = (key: string) => setLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.key !== key)));

  const buildPayload = (): CreateJournalPayload | null => {
    const payloadLines = lines
      .filter((l) => l.accountId && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0))
      .map((l) => {
        const debit = Number(l.debit) || 0;
        const credit = Number(l.credit) || 0;
        return {
          accountId: l.accountId,
          type: (debit > 0 ? "DEBIT" : "CREDIT") as "DEBIT" | "CREDIT",
          amount: debit > 0 ? debit : credit,
          description: l.description || null,
        };
      });

    if (payloadLines.length < 2) {
      setError("Add at least two lines with an account and an amount.");
      return null;
    }
    if (!balanced) {
      setError("Total debits must equal total credits before saving.");
      return null;
    }
    return {
      entryDate,
      reference: reference || null,
      description: description || null,
      notes: notes || null,
      lines: payloadLines,
    };
  };

  const handleSave = async (post: boolean) => {
    setError(null);
    const payload = buildPayload();
    if (!payload) return;
    try {
      await onSubmit({ ...payload, post }, post);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save journal");
    }
  };

  return (
    <div className="surface" style={{ padding: 24 }}>
      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 18 }}>
          {error}
        </div>
      )}

      {/* Header fields */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Date *</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Reference</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Adj-2026-04" style={inputStyle} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Description / Narration</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this entry for?" style={inputStyle} />
        </div>
      </div>

      {/* Lines */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 2fr 1.2fr 1.2fr 36px", gap: 0, background: "var(--bg-elevated)", padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
          <span>Account</span>
          <span>Description</span>
          <span style={{ textAlign: "right" }}>Debit</span>
          <span style={{ textAlign: "right" }}>Credit</span>
          <span />
        </div>
        {lines.map((l) => (
          <div key={l.key} style={{ display: "grid", gridTemplateColumns: "2.2fr 2fr 1.2fr 1.2fr 36px", gap: 8, padding: "8px 12px", borderTop: "1px solid var(--border)", alignItems: "center" }}>
            <select value={l.accountId} onChange={(e) => updateLine(l.key, { accountId: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">Select account…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id} disabled={parentIds.has(o.id)}>
                  {o.code} — {o.name}{parentIds.has(o.id) ? " (group)" : ""}
                </option>
              ))}
            </select>
            <input value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} placeholder="Line note" style={inputStyle} />
            <input
              type="number" step="0.01" min="0" value={l.debit}
              onChange={(e) => updateLine(l.key, { debit: e.target.value, credit: e.target.value ? "" : l.credit })}
              placeholder="0.00" style={{ ...inputStyle, textAlign: "right" }}
            />
            <input
              type="number" step="0.01" min="0" value={l.credit}
              onChange={(e) => updateLine(l.key, { credit: e.target.value, debit: e.target.value ? "" : l.debit })}
              placeholder="0.00" style={{ ...inputStyle, textAlign: "right" }}
            />
            <button onClick={() => removeLine(l.key)} disabled={lines.length <= 2} title="Remove line"
              style={{ background: "none", border: "none", cursor: lines.length <= 2 ? "not-allowed" : "pointer", color: "var(--text-muted)", display: "flex", justifyContent: "center", opacity: lines.length <= 2 ? 0.4 : 1 }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {/* Totals row */}
        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 2fr 1.2fr 1.2fr 36px", gap: 8, padding: "10px 12px", borderTop: "1px solid var(--border-strong)", background: "var(--bg-elevated)", fontWeight: 700, fontSize: 13 }}>
          <span style={{ color: "var(--text-secondary)" }}>Totals</span>
          <span />
          <span style={{ textAlign: "right", color: "var(--text-primary)" }}>{formatCurrency(totals.debit)}</span>
          <span style={{ textAlign: "right", color: "var(--text-primary)" }}>{formatCurrency(totals.credit)}</span>
          <span />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <button onClick={addLine} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 13 }}>
          <Plus size={14} /> Add line
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: balanced ? "#10b981" : "#f59e0b" }}>
          {balanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {balanced ? "Balanced" : `Out of balance by ${formatCurrency(Math.abs(totals.diff))}`}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Notes (internal)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional internal notes…" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onCancel} className="btn-ghost" style={{ padding: "9px 18px" }}>Cancel</button>
        <button onClick={() => handleSave(false)} disabled={submitting} className="btn-ghost" style={{ padding: "9px 18px", opacity: submitting ? 0.6 : 1 }}>
          {mode === "edit" ? "Save Draft" : "Save as Draft"}
        </button>
        <button onClick={() => handleSave(true)} disabled={submitting || !balanced} className="btn-brand" style={{ padding: "9px 18px", opacity: submitting || !balanced ? 0.6 : 1 }}>
          {submitting ? "Saving…" : mode === "edit" ? "Save & Post" : "Post Journal"}
        </button>
      </div>
    </div>
  );
}
