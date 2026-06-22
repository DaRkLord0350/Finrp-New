"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Table, File, CheckCircle2, AlertTriangle, X, Loader2, ArrowRight } from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import { useBankAccounts } from "@/hooks/useBankAccounts";

type FileType = "pdf" | "csv" | "excel" | null;

interface UploadState {
  file: File | null;
  fileType: FileType;
  status: "idle" | "uploading" | "processing" | "done" | "error";
  progress: number;
  errorMsg: string | null;
  importId: string | null;
}

interface ImportRecord {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  bankAccountId: string | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PARTIAL";
  totalRows: number | null;
  successRows: number | null;
  errorRows: number | null;
  duplicateRows: number | null;
  detectedBank: string | null;
  processedAt: string | null;
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
  PARTIAL:    { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
  FAILED:     { bg: "rgba(239,68,68,0.1)",  text: "#ef4444" },
  PROCESSING: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
  PENDING:    { bg: "rgba(99,102,241,0.1)", text: "#818cf8" },
};

// Map an import lifecycle status to an approximate progress bar value.
const STATUS_PROGRESS: Record<string, number> = {
  PENDING: 15, PROCESSING: 65, COMPLETED: 100, PARTIAL: 100, FAILED: 100,
};

const TERMINAL = new Set(["COMPLETED", "FAILED", "PARTIAL"]);

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ImportPage() {
  const [state, setState] = useState<UploadState>({ file: null, fileType: null, status: "idle", progress: 0, errorMsg: null, importId: null });
  const [dragOver, setDragOver] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [result, setResult] = useState<ImportRecord | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
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

  // Poll the active import until it reaches a terminal state, then surface the
  // result card (row counts, duplicates, failures) and refresh the history.
  useEffect(() => {
    if (state.status !== "processing" || !state.importId) return;
    let cancelled = false;
    const importId = state.importId;

    const tick = async () => {
      try {
        const r = await fetch(`/api/banking/import?id=${importId}`);
        if (!r.ok) return;
        const { import: rec } = (await r.json()) as { import: ImportRecord };
        if (cancelled) return;
        setState(s => ({ ...s, progress: STATUS_PROGRESS[rec.status] ?? s.progress }));
        if (TERMINAL.has(rec.status)) {
          setResult(rec);
          setState(s => ({ ...s, status: "done", progress: 100 }));
          qc.invalidate(["banking", "imports"]);
          qc.invalidate(["banking", "transactions"]);
          qc.invalidate(["banking", "accounts"]);
        }
      } catch {
        /* transient — keep polling */
      }
    };

    void tick();
    const iv = setInterval(tick, 2000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [state.status, state.importId, qc]);

  const handleFile = (file: File) => {
    let fileType: FileType = null;
    if (file.name.endsWith(".pdf")) fileType = "pdf";
    else if (file.name.endsWith(".csv")) fileType = "csv";
    else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) fileType = "excel";
    else { alert("Unsupported file type. Please upload PDF, CSV, or Excel."); return; }
    setState({ file, fileType, status: "idle", progress: 0, errorMsg: null, importId: null });
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!state.file) return;
    setState(s => ({ ...s, status: "uploading", progress: 10, errorMsg: null }));
    try {
      // Upload the actual file as multipart/form-data — the server stores it and
      // derives fileType/fileName/fileSize. (Don't set Content-Type: the browser
      // adds the multipart boundary automatically.)
      const fd = new FormData();
      fd.append("file", state.file);
      if (selectedBank) fd.append("bankAccountId", selectedBank);
      const res = await fetch("/api/banking/import", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setState(s => ({ ...s, status: "error", errorMsg: err.error ?? "Upload failed" }));
        return;
      }
      const { importId } = (await res.json()) as { importId: string };
      // Hand off to the poller — it watches the import through to completion.
      setState(s => ({ ...s, status: "processing", progress: 15, importId }));
      qc.invalidate(["banking", "imports"]);
    } catch {
      setState(s => ({ ...s, status: "error", errorMsg: "Network error. Please try again." }));
    }
  };

  const reset = useCallback(() => {
    setState({ file: null, fileType: null, status: "idle", progress: 0, errorMsg: null, importId: null });
    setResult(null);
  }, []);

  const viewTransactions = useCallback(() => {
    const acc = result?.bankAccountId;
    router.push(acc ? `/banking/transactions?bankAccountId=${acc}` : "/banking/transactions");
  }, [result, router]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Import Statements</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Upload PDF, CSV, or Excel bank statements to import transactions</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
        {/* Upload / status column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {state.status === "done" && result ? (
            <ResultCard result={result} onViewTransactions={viewTransactions} onReset={reset} />
          ) : state.status === "processing" ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <Loader2 size={30} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Processing your statement…</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                Parsing rows, detecting duplicates, and saving transactions. This usually takes a few seconds.
              </p>
              <div style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--bg-hover)", overflow: "hidden", marginTop: 4 }}>
                <div style={{ height: "100%", borderRadius: 3, background: "#6366f1", width: `${state.progress}%`, transition: "width 0.3s" }} />
              </div>
              {state.file && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{state.file.name}</p>}
            </div>
          ) : state.status === "error" ? (
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={28} color="#ef4444" />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#ef4444" }}>Upload failed</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{state.errorMsg}</p>
              <button onClick={reset} style={{ fontSize: 12, padding: "7px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>Try Again</button>
            </div>
          ) : !state.file ? (
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
              <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} style={{ width: "100%", fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", marginBottom: 10, boxSizing: "border-box" }}>
                <option value="">— Auto-detect bank account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.bankName} {a.maskedNumber}</option>)}
              </select>
              {state.errorMsg && <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>{state.errorMsg}</p>}
              <button onClick={handleSubmit} disabled={state.status === "uploading"} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "none", background: "#6366f1", fontSize: 13, fontWeight: 600, color: "white", cursor: state.status === "uploading" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {state.status === "uploading" && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                {state.status === "uploading" ? "Uploading…" : "Submit for Import"}
              </button>
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
                    {(imp.status === "COMPLETED" || imp.status === "PARTIAL") && imp.totalRows !== null && (
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        {imp.successRows ?? 0}/{imp.totalRows} rows · {imp.duplicateRows ?? 0} dupes · {imp.errorRows ?? 0} err
                      </p>
                    )}
                    {imp.status === "FAILED" && (
                      <p style={{ fontSize: 10, color: "#ef4444", marginTop: 2 }}>Import failed · {imp.errorRows ?? 0} errors</p>
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

function ResultCard({ result, onViewTransactions, onReset }: {
  result: ImportRecord;
  onViewTransactions: () => void;
  onReset: () => void;
}) {
  const ok = result.status === "COMPLETED" || result.status === "PARTIAL";
  const imported = result.successRows ?? 0;
  const accent = result.status === "COMPLETED" ? "#10b981" : result.status === "PARTIAL" ? "#f59e0b" : "#ef4444";
  const title =
    result.status === "COMPLETED" ? "Statement imported successfully"
    : result.status === "PARTIAL" ? "Statement imported with some issues"
    : "Import failed";

  return (
    <div style={{ background: "var(--bg-card)", border: `1px solid ${accent}40`, borderRadius: 12, padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {ok ? <CheckCircle2 size={26} color={accent} /> : <AlertTriangle size={26} color={accent} />}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{ok ? "✅ " : ""}{title}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {result.fileName} · {result.processedAt ? formatDateTime(result.processedAt) : formatDateTime(result.createdAt)}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <Stat label="Rows Imported" value={imported} color="#10b981" />
        <Stat label="Duplicates Skipped" value={result.duplicateRows ?? 0} color="#f59e0b" />
        <Stat label="Failed Rows" value={result.errorRows ?? 0} color="#ef4444" />
      </div>

      {result.status === "FAILED" && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          We couldn&apos;t import any rows from this file. Check that the columns include a date, a description, and debit/credit amounts, then try again.
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {imported > 0 && (
          <button onClick={onViewTransactions} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#6366f1", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
            View Transactions <ArrowRight size={14} />
          </button>
        )}
        <button onClick={onReset} style={{ flex: imported > 0 ? "0 0 auto" : 1, padding: "10px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 13, fontWeight: 500, color: "var(--text-primary)", cursor: "pointer" }}>
          Import Another
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "var(--bg-hover)", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
      <p style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value.toLocaleString("en-IN")}</p>
      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
    </div>
  );
}
