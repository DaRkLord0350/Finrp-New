"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Table, File, CheckCircle2, AlertTriangle, X, Eye, Loader2, ChevronRight } from "lucide-react";

type FileType = "pdf" | "csv" | "excel" | null;

interface UploadState {
  file: File | null;
  fileType: FileType;
  status: "idle" | "uploading" | "parsing" | "preview" | "complete" | "error";
  progress: number;
  detectedBank: string | null;
  parsedRows: number;
  errorRows: number;
  duplicateRows: number;
  preview: Array<{ date: string; narration: string; debit: string; credit: string; balance: string }>;
}

const FILE_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pdf:   { icon: <FileText size={20} />, color: "#ef4444", label: "PDF Statement" },
  csv:   { icon: <Table size={20} />,    color: "#10b981", label: "CSV File" },
  excel: { icon: <File size={20} />,     color: "#f59e0b", label: "Excel File" },
};

const RECENT_IMPORTS = [
  { id: "1", fileName: "HDFC_Jun_2026.pdf", bank: "HDFC Bank", rows: 142, status: "COMPLETED", date: "10 Jun 2026", errors: 0, duplicates: 3 },
  { id: "2", fileName: "ICICI_May_2026.csv", bank: "ICICI Bank", rows: 89, status: "COMPLETED", date: "08 Jun 2026", errors: 2, duplicates: 1 },
  { id: "3", fileName: "SBI_Q1_2026.xlsx", bank: "SBI", rows: 234, status: "FAILED", date: "05 Jun 2026", errors: 234, duplicates: 0 },
];

export default function ImportPage() {
  const [state, setState] = useState<UploadState>({ file: null, fileType: null, status: "idle", progress: 0, detectedBank: null, parsedRows: 0, errorRows: 0, duplicateRows: 0, preview: [] });
  const [dragOver, setDragOver] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    let fileType: FileType = null;
    if (file.name.endsWith(".pdf")) fileType = "pdf";
    else if (file.name.endsWith(".csv")) fileType = "csv";
    else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) fileType = "excel";
    else { alert("Unsupported file type. Please upload PDF, CSV, or Excel."); return; }

    setState(s => ({ ...s, file, fileType, status: "uploading", progress: 0 }));

    // Simulate upload + parsing
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        clearInterval(interval);
        setState(s => ({
          ...s, status: "preview", progress: 100,
          detectedBank: "HDFC Bank", parsedRows: 142, errorRows: 2, duplicateRows: 3,
          preview: [
            { date: "10/06/2026", narration: "NEFT/Rajesh Traders/INV-2421", debit: "", credit: "487500.00", balance: "12400000.00" },
            { date: "09/06/2026", narration: "GST PMT-06/CGST+SGST", debit: "184200.00", credit: "", balance: "11900100.00" },
            { date: "08/06/2026", narration: "IMPS/Salary June 2026", debit: "2340000.00", credit: "", balance: "14187900.00" },
            { date: "08/06/2026", narration: "NEFT/Sunrise Exports Ltd", debit: "", credit: "924000.00", balance: "15111900.00" },
          ],
        }));
      } else {
        setState(s => ({ ...s, progress, status: progress < 50 ? "uploading" : "parsing" }));
      }
    }, 200);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const reset = () => setState({ file: null, fileType: null, status: "idle", progress: 0, detectedBank: null, parsedRows: 0, errorRows: 0, duplicateRows: 0, preview: [] });

  const ftc = state.fileType ? FILE_TYPE_CONFIG[state.fileType] : null;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Import Statements</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Upload PDF, CSV, or Excel bank statements for automatic parsing</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        {/* Upload Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {state.status === "idle" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                style={{ border: `2px dashed ${dragOver ? "#6366f1" : "var(--border)"}`, borderRadius: 14, padding: "40px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "rgba(99,102,241,0.04)" : "var(--bg-card)", transition: "all 0.2s ease" }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Upload size={24} color="#6366f1" />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Drop your bank statement here</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>or click to browse · PDF, CSV, Excel supported</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Password-protected PDFs supported</p>
              </div>
              <input ref={inputRef} type="file" accept=".pdf,.csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} style={{ display: "none" }} />

              {/* Format Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {Object.entries(FILE_TYPE_CONFIG).map(([type, cfg]) => (
                  <div key={type} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 6, color: cfg.color }}>{cfg.icon}</div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{cfg.label}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{type === "pdf" ? "Auto-parsed" : type === "csv" ? "Column mapping" : "All formats"}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Uploading / Parsing */}
          {(state.status === "uploading" || state.status === "parsing") && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ color: ftc?.color }}>{ftc?.icon}</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{state.file?.name}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{state.status === "uploading" ? "Uploading..." : "Parsing transactions..."}</p>
                </div>
                <Loader2 size={16} color="var(--text-muted)" style={{ marginLeft: "auto", animation: "spin 1s linear infinite" }} />
              </div>
              <div style={{ height: 6, borderRadius: 6, background: "var(--border)" }}>
                <div style={{ height: 6, borderRadius: 6, background: "#6366f1", width: `${state.progress}%`, transition: "width 0.3s ease" }} />
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "right" }}>{Math.round(state.progress)}%</p>
            </div>
          )}

          {/* Preview / Bank Selection */}
          {state.status === "preview" && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Import Preview</h3>
                <button onClick={reset} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><X size={14} color="var(--text-muted)" /></button>
              </div>

              {/* Detection */}
              {state.detectedBank && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <CheckCircle2 size={13} color="#10b981" />
                  <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Detected bank: <b style={{ color: "#10b981" }}>{state.detectedBank}</b></p>
                </div>
              )}

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  [`${state.parsedRows} rows parsed`, "#10b981"],
                  [`${state.duplicateRows} duplicates`, "#f59e0b"],
                  [`${state.errorRows} errors`, "#ef4444"],
                ].map(([label, color]) => (
                  <div key={String(label)} style={{ textAlign: "center", padding: "8px", borderRadius: 8, background: "var(--bg-hover)" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: String(color) }}>{String(label).split(" ")[0]}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{String(label).split(" ").slice(1).join(" ")}</p>
                  </div>
                ))}
              </div>

              {/* Account Select */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>ASSIGN TO BANK ACCOUNT</label>
                <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                  <option value="">Select account...</option>
                  <option value="hdfc4821">HDFC Bank XXXX4821</option>
                  <option value="icici9032">ICICI Bank XXXX9032</option>
                  <option value="sbi1197">SBI XXXX1197</option>
                </select>
              </div>

              <button onClick={() => setState(s => ({ ...s, status: "complete" }))} disabled={!selectedBank} style={{ padding: "10px 0", borderRadius: 9, border: "none", background: "#6366f1", fontSize: 13, fontWeight: 600, color: "white", cursor: selectedBank ? "pointer" : "default", opacity: selectedBank ? 1 : 0.5 }}>
                Import {state.parsedRows} Transactions
              </button>
            </div>
          )}

          {/* Complete */}
          {state.status === "complete" && (
            <div style={{ background: "var(--bg-card)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: 24, textAlign: "center" }}>
              <CheckCircle2 size={40} color="#10b981" style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: "#10b981", marginBottom: 4 }}>Import Complete!</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{state.parsedRows} transactions imported successfully</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button onClick={reset} style={{ padding: "8px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>Import Another</button>
                <a href="/banking/transactions" style={{ padding: "8px 0", borderRadius: 8, border: "none", background: "#6366f1", fontSize: 12, color: "white", cursor: "pointer", textAlign: "center", textDecoration: "none", display: "block" }}>View Transactions</a>
              </div>
            </div>
          )}
        </div>

        {/* Preview Table + Recent Imports */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {state.preview.length > 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Transaction Preview (first {state.preview.length} rows)</p>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-hover)" }}>
                      {["Date", "Narration", "Debit", "Credit", "Balance"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textAlign: "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.preview.map((row, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 10px", fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{row.date}</td>
                        <td style={{ padding: "7px 10px", fontSize: 11, color: "var(--text-primary)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.narration}</td>
                        <td style={{ padding: "7px 10px", fontSize: 11, color: "#ef4444", textAlign: "right" }}>{row.debit}</td>
                        <td style={{ padding: "7px 10px", fontSize: 11, color: "#10b981", textAlign: "right" }}>{row.credit}</td>
                        <td style={{ padding: "7px 10px", fontSize: 11, color: "var(--text-secondary)", textAlign: "right" }}>{row.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Imports */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Recent Imports</p>
            </div>
            <div>
              {RECENT_IMPORTS.map((imp, i) => (
                <div key={imp.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: imp.status === "COMPLETED" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {imp.status === "COMPLETED" ? <CheckCircle2 size={14} color="#10b981" /> : <AlertTriangle size={14} color="#ef4444" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{imp.fileName}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{imp.bank} · {imp.date} · {imp.rows} rows</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: imp.status === "COMPLETED" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: imp.status === "COMPLETED" ? "#10b981" : "#ef4444" }}>{imp.status}</span>
                    {imp.duplicates > 0 && <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>{imp.duplicates} duplicates skipped</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
