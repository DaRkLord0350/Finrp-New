"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, queryClient } from "@/lib/queryCache";
import { Download, FileText, RefreshCw, CheckCircle2, Clock, AlertCircle, ExternalLink } from "lucide-react";

type Report = {
  id: string;
  statementType: string;
  periodStart: string;
  periodEnd: string;
};

type ExportJob = {
  id: string;
  format: "PDF" | "EXCEL" | "BOTH";
  status: "PENDING" | "GENERATING" | "READY" | "FAILED";
  createdAt: string;
  fileUrl?: string;
  includeSignaturePlaceholder?: boolean;
};

type ExportFormat = "PDF" | "EXCEL" | "BOTH";

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING:    <Clock size={14} style={{ color: "#fbbf24" }} />,
  GENERATING: <RefreshCw size={14} style={{ color: "#60a5fa" }} />,
  READY:      <CheckCircle2 size={14} style={{ color: "#34d399" }} />,
  FAILED:     <AlertCircle size={14} style={{ color: "#f87171" }} />,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:    { bg: "rgba(245,158,11,0.12)",  text: "#fbbf24" },
  GENERATING: { bg: "rgba(59,130,246,0.12)",  text: "#60a5fa" },
  READY:      { bg: "rgba(16,185,129,0.12)",  text: "#34d399" },
  FAILED:     { bg: "rgba(239,68,68,0.12)",   text: "#f87171" },
};

export default function ExportPage() {
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [format, setFormat] = useState<ExportFormat>("PDF");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeAdjustments, setIncludeAdjustments] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: reports, isLoading: reportsLoading } = useQuery<Report[]>(
    ["fs-reports-list"],
    async () => {
      const r = await fetch("/api/financial-statements/reports");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }
  );

  const { data: exports, isLoading: exportsLoading } = useQuery<ExportJob[]>(
    ["fs-exports", selectedReportId],
    async () => {
      if (!selectedReportId) return [];
      const r = await fetch(`/api/financial-statements/exports?reportId=${selectedReportId}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    { enabled: !!selectedReportId, staleTime: 0 }
  );

  const list = exports ?? [];
  const hasPending = list.some((e) => e.status === "PENDING" || e.status === "GENERATING");
  const lastReady = list.find((e) => e.status === "READY");

  // Poll every 5s while there are pending/generating exports
  useEffect(() => {
    if (!selectedReportId) return;
    if (hasPending) {
      pollRef.current = setInterval(() => {
        queryClient.invalidate(["fs-exports", selectedReportId]);
      }, 5000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [hasPending, selectedReportId]);

  async function triggerExport() {
    if (!selectedReportId) return;
    setGenerating(true);
    try {
      const r = await fetch("/api/financial-statements/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: selectedReportId,
          format,
          includeNotes,
          includeAdjustments,
          includeSignaturePlaceholder: includeSignature,
        }),
      });
      if (!r.ok) throw new Error("Export request failed");
      queryClient.invalidate(["fs-exports", selectedReportId]);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Export Center
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Generate PDF and Excel exports of your financial statements.
          </p>
        </div>
      </div>

      {/* Report selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Report</label>
        {reportsLoading ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading reports…</div>
        ) : (
          <select
            value={selectedReportId}
            onChange={(e) => setSelectedReportId(e.target.value)}
            style={{
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "8px 12px", fontSize: 13,
              color: "var(--text-primary)", minWidth: 360,
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

      {!selectedReportId ? (
        <div className="surface" style={{ padding: 40, textAlign: "center", borderRadius: 12 }}>
          <Download size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Select a report to export.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Export options panel */}
          <div className="surface" style={{ borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>Export Options</h2>

            {/* Format selector */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 10 }}>Format</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(["PDF", "EXCEL", "BOTH"] as ExportFormat[]).map((f) => (
                  <label key={f} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="format"
                      value={f}
                      checked={format === f}
                      onChange={() => setFormat(f)}
                      style={{ accentColor: "#6366f1" }}
                    />
                    <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: format === f ? 600 : 400 }}>
                      {f === "BOTH" ? "PDF + Excel" : f === "PDF" ? "PDF only" : "Excel only"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Checkboxes */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 10 }}>Include</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Notes & Accounting Policies", value: includeNotes, set: setIncludeNotes },
                  { label: "Adjustment Journals", value: includeAdjustments, set: setIncludeAdjustments },
                  { label: "Digital Signature Placeholder", value: includeSignature, set: setIncludeSignature },
                ].map(({ label, value, set }) => (
                  <label key={label} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => set(e.target.checked)}
                      style={{ accentColor: "#6366f1", width: 14, height: 14 }}
                    />
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={triggerExport}
              disabled={generating}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 16px", background: "#6366f1", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: generating ? "not-allowed" : "pointer",
                opacity: generating ? 0.7 : 1,
              }}
            >
              <Download size={14} />
              {generating ? "Requesting…" : "Generate Export"}
            </button>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                PDF exports include a digital signature placeholder area.
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                Excel exports include separate sheets per section.
              </p>
            </div>
          </div>

          {/* Right panel: preview + history */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Preview / last ready */}
            {lastReady && (
              <div className="surface" style={{ borderRadius: 12, padding: 18 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 10px" }}>Last Successful Export</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={20} style={{ color: "#34d399" }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{lastReady.format} Export</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{new Date(lastReady.createdAt).toLocaleString()}</p>
                  </div>
                  {lastReady.fileUrl && (
                    <a
                      href={lastReady.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                        background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
                        borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#34d399",
                        textDecoration: "none",
                      }}
                    >
                      <Download size={12} /> Download
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* History table */}
            <div className="surface" style={{ borderRadius: 12, overflow: "hidden", flex: 1 }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Export History</h3>
                {hasPending && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#60a5fa" }}>
                    <RefreshCw size={11} /> Auto-refreshing…
                  </div>
                )}
              </div>
              {exportsLoading ? (
                <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Loading…</div>
              ) : list.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>No exports yet.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      {["Format", "Status", "Created", ""].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((job) => {
                      const sc = STATUS_COLORS[job.status] ?? STATUS_COLORS.PENDING;
                      return (
                        <tr key={job.id} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{job.format}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {STATUS_ICON[job.status]}
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
                                background: sc.bg, color: sc.text,
                              }}>
                                {job.status}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)" }}>
                            {new Date(job.createdAt).toLocaleString()}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            {job.status === "READY" && job.fileUrl && (
                              <a
                                href={job.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  fontSize: 12, color: "#6366f1", fontWeight: 600,
                                  textDecoration: "none",
                                }}
                              >
                                <ExternalLink size={11} /> Download
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
