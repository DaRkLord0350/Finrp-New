"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, File, CheckCircle2, Calendar, Filter } from "lucide-react";

const EXPORT_REPORTS = [
  { id: "transactions", label: "Transaction Report", description: "All transactions with categories, tags, and reconciliation status", formats: ["xlsx", "csv", "pdf"], icon: <FileSpreadsheet size={18} color="#10b981" /> },
  { id: "reconciliation", label: "Reconciliation Report", description: "Matched, unmatched and exception summary with ledger references", formats: ["xlsx", "pdf"], icon: <File size={18} color="#6366f1" /> },
  { id: "cash_flow", label: "Cash Flow Statement", description: "Daily/monthly cash flow with forecasts and variance analysis", formats: ["xlsx", "pdf"], icon: <FileText size={18} color="#f59e0b" /> },
  { id: "gst_match", label: "GST Reconciliation", description: "Bank vs GSTR-1/2A/2B/3B matching with ITC impact analysis", formats: ["xlsx", "pdf"], icon: <FileText size={18} color="#ef4444" /> },
  { id: "risk", label: "Risk & Fraud Report", description: "Risk alerts, duplicate payments, and anomaly summary", formats: ["xlsx", "pdf"], icon: <FileText size={18} color="#8b5cf6" /> },
  { id: "bank_summary", label: "Bank Account Summary", description: "Balance sheet, account health, and consent status overview", formats: ["xlsx", "pdf"], icon: <FileSpreadsheet size={18} color="#06b6d4" /> },
];

export default function ExportPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState("xlsx");
  const [dateFrom, setDateFrom] = useState("2026-06-01");
  const [dateTo, setDateTo] = useState("2026-06-30");
  const [bank, setBank] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleExport = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 1800));
    setDone(selected);
    setExporting(false);
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Export Center</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Export banking data and reports in multiple formats</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* Report Selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Select reports to export</p>
          {EXPORT_REPORTS.map((report) => {
            const isSelected = selected.includes(report.id);
            const isDone = done.includes(report.id);
            return (
              <div
                key={report.id}
                onClick={() => toggle(report.id)}
                style={{ background: "var(--bg-card)", border: `1px solid ${isSelected ? "#6366f1" : "var(--border)"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s" }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isDone ? <CheckCircle2 size={18} color="#10b981" /> : report.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{report.label}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{report.description}</p>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    {report.formats.map(f => (
                      <span key={f} style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "var(--border)", color: "var(--text-muted)", textTransform: "uppercase" }}>{f}</span>
                    ))}
                  </div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isSelected ? "#6366f1" : "var(--border)"}`, background: isSelected ? "#6366f1" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isSelected && <CheckCircle2 size={12} color="white" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Export Config Panel */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Export Settings</h3>

          {/* Format */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>FORMAT</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {["xlsx", "csv", "pdf"].map(f => (
                <button key={f} onClick={() => setFormat(f)} style={{ padding: "8px 0", borderRadius: 7, border: `1px solid ${format === f ? "#6366f1" : "var(--border)"}`, background: format === f ? "rgba(99,102,241,0.1)" : "var(--bg-card)", color: format === f ? "#6366f1" : "var(--text-secondary)", fontSize: 12, fontWeight: format === f ? 600 : 400, cursor: "pointer", textTransform: "uppercase" }}>{f}</button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>DATE RANGE</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ flex: 1, fontSize: 12, padding: "7px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none" }} />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ flex: 1, fontSize: 12, padding: "7px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none" }} />
            </div>
          </div>

          {/* Bank Filter */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>BANK ACCOUNT</label>
            <select value={bank} onChange={e => setBank(e.target.value)} style={{ width: "100%", fontSize: 12, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
              <option value="all">All Accounts</option>
              <option value="hdfc4821">HDFC Bank XXXX4821</option>
              <option value="icici9032">ICICI Bank XXXX9032</option>
              <option value="sbi1197">SBI XXXX1197</option>
            </select>
          </div>

          {/* Selected Summary */}
          <div style={{ background: "var(--bg-hover)", borderRadius: 8, padding: "10px 12px" }}>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}><b>{selected.length}</b> report{selected.length !== 1 ? "s" : ""} selected</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Format: {format.toUpperCase()} · {dateFrom} to {dateTo}</p>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={selected.length === 0 || exporting}
            style={{ padding: "10px 0", borderRadius: 9, border: "none", background: selected.length === 0 ? "var(--border)" : "#6366f1", fontSize: 13, fontWeight: 600, color: selected.length === 0 ? "var(--text-muted)" : "white", cursor: selected.length === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {exporting ? (
              <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} /> Exporting...</>
            ) : (
              <><Download size={14} /> Export Selected ({selected.length})</>
            )}
          </button>

          {done.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <CheckCircle2 size={12} color="#10b981" />
              <p style={{ fontSize: 11, color: "#10b981" }}>{done.length} report{done.length !== 1 ? "s" : ""} exported successfully</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
