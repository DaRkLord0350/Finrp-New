"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Table, File, CheckCircle2, AlertTriangle, X, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import { useBankAccounts } from "@/hooks/useBankAccounts";

type FileType = "pdf" | "csv" | "excel" | null;

interface UploadState {
  file: File | null;
  fileType: FileType;
  status: "idle" | "uploading" | "done" | "error";
  progress: number;
  errorMsg: string | null;
}

interface ImportRecord {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  totalRows: number | null;
  successRows: number | null;
  errorRows: number | null;
  duplicateRows: number | null;
  detectedBank: string | null;
  createdAt: string;
  bankAccount: { bankName: string; accountNumber: string } | null;
}

const FILE_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pdf:   { icon: <FileText size={20} />, color: "#ef4444", label: "PDF Statement" },
  csv:   { icon: <Table size={20} />,    color: "#10b981", label: "CSV File" },
  excel: { icon: <File size={20} />,     color: "#f59e0b", label: "Excel File" },
};

const STATUS_CFG: Record<string, { bg: string; text: string }> = {
  COMPLETED:  { bg: "rgba(16,185,129,0.1)", text: "#10b981" },
  FAILED:     { bg: "rgba(239,68,68,0.1)",  text: "#ef4444" },
  PROCESSING: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
  PENDING:    { bg: "rgba(99,102,241,0.1)", text: "#818cf8" },
};

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ImportPage() {
  const [state, setState] = useState<UploadState>({ file: null, fileType: null, status: "idle", progress: 0, errorMsg: null });
  const [dragOver, setDragOver] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { accounts } = useBankAccounts();
  const { data, isLoading } = useQuery(
    ["banking", "imports"],
    async () => {
      const r = await fetch("/api/banking/import");
      if (!r.ok) return { imports: [] as ImportRecord[] };
      return r.json() as Promise<{ imports: ImportRecord[] }>;
    },
    { staleTime: 30_000 }
  );

  const imports = data?.imports ?? [];

  const handleFile = (file: File) => {
    let fileType: FileType = null;
    if (file.name.endsWith(".pdf")) fileType = "pdf";
    else if (file.name.endsWith(".csv")) fileType = "csv";
    else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) fileType = "excel";
    else { alert("Unsupported file type. Please upload PDF, CSV, or Excel."); return; }
    setState(s => ({ ...s, file, fileType, status: "uploading", progress: 0, errorMsg: null }));
    // Simulate progress to 80% while user confirms — actual submission on button click
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 12;
      if (p >= 80) { clearInterval(iv); p = 80; }
      setState(s => ({ ...s, progress: Math.min(p, 80) }));
    }, 120);
  };

  const handleSubmit = async () => {
    if (!state.file) return;
    setState(s => ({ ...s, status: "uploading", progress: 80 }));
    try {
      const body = {
        fileName: state.file.name,
        fileType: state.fileType === "excel" ? "XLSX" : state.fileType?.toUpperCase() ?? "CSV",
        fileSize: state.file.size,
        fileUrl: null,
        bankAccountId: selectedBank || undefined,
      };
      const res = await fetch("/api/banking/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        setState(s => ({ ...s, status: "error", errorMsg: err.error ?? "Upload failed" }));
        return;
      }
      setState(s => ({ ...s, status: "done", progress: 100 }));
      qc.invalidate(["banking", "imports"]);
    } catch {
      setState(s => ({ ...s, status: "error", errorMsg: "Network error. Please try again." }));
    }
  };

  const reset = () => setState({ file: null, fileType: null, status: "idle", progress: 0, errorMsg: null });

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Import Statements</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Upload PDF, CSV, or Excel bank statements to import transactions</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
        {/* Upload Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {state.status === "idle" || state.status === "uploading" ? (
            <>
              {!state.file ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => inputRef.current?.click()}
                  style={{ border: `2px dashed ${dragOver ? "#6366f1" : "var(--border)"}`, borderRadius: 12, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, cursor: "pointer", background: dragOver ? "rgba(99,102,241,0.04)" : "var(--bg-card)", transition: "all 0.15s" }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(99,102,241,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Upload size={24} color="#6366f1" />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Drop your statement here</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>or click to browse · PDF, CSV, Excel supported</p>
                  </div>
                  <input ref={inputRef} type="file" accept=".pdf,.csv,.xlsx,.xls" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              ) : (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ color: FILE_TYPE_CONFIG[state.fileType ?? "csv"]?.color ?? "#6366f1" }}>
                      {FILE_TYPE_CONFIG[state.fileType ?? "csv"]?.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{state.file.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatSize(state.file.size)} · {FILE_TYPE_CONFIG[state.fileType ?? "csv"]?.label}</p>
                    </div>
                    <button onClick={reset} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-hover)", overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ height: "100%", borderRadius: 3, background: "#6366f1", width: `${state.progress}%`, transition: "width 0.2s" }} />
                  </div>
                  <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} style={{ width: "100%", fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", marginBottom: 10, boxSizing: "border-box" }}>
                    <option value="">— Auto-detect bank account —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.bankName} {a.maskedNumber}</option>)}
                  </select>
                  {state.errorMsg && <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>{state.errorMsg}</p>}
                  <button onClick={handleSubmit} disabled={state.status === "uploading" && state.progress < 80} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "none", background: "#6366f1", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
                    {state.status === "uploading" ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} /> : null}
                    Submit for Import
                  </button>
                </div>
              )}
            </>
          ) : state.status === "done" ? (
            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={32} color="#10b981" />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#10b981" }}>Import queued successfully!</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Processing will start shortly. Check the history below.</p>
              <button onClick={reset} style={{ fontSize: 12, padding: "7px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>Import Another</button>
            </div>
          ) : (
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={28} color="#ef4444" />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#ef4444" }}>Import failed</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{state.errorMsg}</p>
              <button onClick={reset} style={{ fontSize: 12, padding: "7px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>Try Again</button>
            </div>
          )}

          {/* Supported formats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {Object.entries(FILE_TYPE_CONFIG).map(([type, cfg]) => (
              <div key={type} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ color: cfg.color }}>{cfg.icon}</div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{cfg.label}</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)" }}>.{type === "excel" ? "xlsx / xls" : type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Imports */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>Recent Imports</p>
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 60, borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />)}
            </div>
          ) : imports.length === 0 ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: 20, textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No imports yet</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {imports.slice(0, 10).map(imp => {
                const cfg = STATUS_CFG[imp.status] ?? STATUS_CFG.PENDING;
                return (
                  <div key={imp.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imp.fileName}</p>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: cfg.bg, color: cfg.text }}>{imp.status}</span>
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{imp.bankAccount?.bankName ?? imp.detectedBank ?? "Auto"} · {formatDate(imp.createdAt)}</p>
                    {imp.status === "COMPLETED" && imp.totalRows !== null && (
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        {imp.successRows}/{imp.totalRows} rows · {imp.duplicateRows ?? 0} dupes · {imp.errorRows ?? 0} err
                      </p>
                    )}
                    {imp.status === "FAILED" && imp.errorRows !== null && (
                      <p style={{ fontSize: 10, color: "#ef4444", marginTop: 2 }}>{imp.errorRows} errors</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
