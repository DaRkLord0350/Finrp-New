"use client";

import { useRef, useState } from "react";
import { X, UploadCloud, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; code: string; message: string }[];
}

interface ImportAccountsModalProps {
  onClose: () => void;
  onImported: () => void;
}

const SAMPLE_CSV =
  "Code,Account Name,Type,Subtype,Parent Account,Opening Balance\r\n" +
  "1500,Petty Cash,CASH,Petty Cash,,5000\r\n" +
  "1510,Marketing Bank,BANK,Current Account,,0\r\n" +
  "4100,Consulting Income,INCOME,General Income,,0\r\n";

export function ImportAccountsModal({ onClose, onImported }: ImportAccountsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chart-of-accounts-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file) { setError("Please choose a CSV file first."); return; }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/chart-of-accounts/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data as ImportResult);
      if (data.created > 0 || data.updated > 0) onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 16,
          padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Import Chart of Accounts</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              Upload a CSV. Existing codes are updated; new codes are created.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!result && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                width: "100%", border: "1.5px dashed var(--border-strong)", borderRadius: 12,
                background: "var(--bg-elevated)", padding: "28px 16px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--text-secondary)",
              }}
            >
              {file ? <FileText size={26} color="var(--brand-400)" /> : <UploadCloud size={26} color="var(--text-muted)" />}
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                {file ? file.name : "Click to choose a CSV file"}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "Headers: Code, Account Name, Type, Subtype, Parent Account, Opening Balance"}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }}
            />

            <button onClick={downloadSample} style={{ background: "none", border: "none", color: "var(--brand-400)", fontSize: 12, cursor: "pointer", marginTop: 12, textDecoration: "underline" }}>
              Download template CSV
            </button>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: "9px 18px" }}>Cancel</button>
              <button onClick={handleUpload} disabled={submitting || !file} className="btn-brand" style={{ padding: "9px 18px", opacity: submitting || !file ? 0.6 : 1 }}>
                {submitting ? "Importing…" : "Import"}
              </button>
            </div>
          </>
        )}

        {result && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              {result.errors.length === 0
                ? <CheckCircle2 size={20} color="#10b981" />
                : <AlertTriangle size={20} color="#f59e0b" />}
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                Imported {result.created + result.updated} of {result.total} row(s)
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Created", value: result.created, color: "#10b981" },
                { label: "Updated", value: result.updated, color: "#818cf8" },
                { label: "Skipped", value: result.skipped, color: "#f59e0b" },
                { label: "Errors", value: result.errors.length, color: "#ef4444" },
              ].map((s) => (
                <div key={s.label} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</p>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)" }}>
                    <span style={{ color: "#ef4444", fontWeight: 600 }}>Row {e.row}</span>
                    {e.code ? ` (${e.code})` : ""}: {e.message}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={onClose} className="btn-brand" style={{ padding: "9px 18px" }}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
