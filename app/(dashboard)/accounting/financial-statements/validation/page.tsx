"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@/lib/queryCache";
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  FileBarChart,
} from "lucide-react";
import { useRouter } from "next/navigation";

type ValidationSeverity = "error" | "warning" | "info";

type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  affectedKeys?: string[];
  amount?: number;
};

type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  summary: string;
};

type Report = {
  id: string;
  statementType: string;
  periodStart: string;
  periodEnd: string;
};

const SEV_ICON: Record<ValidationSeverity, React.ReactNode> = {
  error: <XCircle size={14} style={{ color: "#f87171" }} />,
  warning: <AlertTriangle size={14} style={{ color: "#fbbf24" }} />,
  info: <Info size={14} style={{ color: "#60a5fa" }} />,
};

const SEV_COLORS: Record<ValidationSeverity, { bg: string; border: string; badge: string; text: string }> = {
  error:   { bg: "rgba(239,68,68,0.06)",   border: "rgba(239,68,68,0.3)",   badge: "rgba(239,68,68,0.15)",  text: "#f87171" },
  warning: { bg: "rgba(245,158,11,0.06)",  border: "rgba(245,158,11,0.3)",  badge: "rgba(245,158,11,0.15)", text: "#fbbf24" },
  info:    { bg: "rgba(59,130,246,0.06)",   border: "rgba(59,130,246,0.3)",  badge: "rgba(59,130,246,0.15)", text: "#60a5fa" },
};

export default function ValidationPage() {
  const router = useRouter();
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const { data: reports, isLoading: reportsLoading } = useQuery<Report[]>(
    ["fs-reports-list"],
    async () => {
      const r = await fetch("/api/financial-statements/reports");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }
  );

  const runValidation = useCallback(async () => {
    if (!selectedReportId) return;
    setRunning(true);
    setRunError(null);
    try {
      const r = await fetch(`/api/financial-statements/reports/${selectedReportId}/validate`);
      if (!r.ok) throw new Error("Validation request failed");
      const data: ValidationResult = await r.json();
      setValidationResult(data);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }, [selectedReportId]);

  const totalIssues = validationResult
    ? validationResult.errors.length + validationResult.warnings.length
    : 0;

  const issueGroups: Array<{ severity: ValidationSeverity; items: ValidationIssue[]; label: string }> = validationResult
    ? [
        { severity: "error",   items: validationResult.errors,   label: "Errors" },
        { severity: "warning", items: validationResult.warnings, label: "Warnings" },
        { severity: "info",    items: validationResult.infos,    label: "Info" },
      ]
    : [];

  const progressPct = validationResult
    ? validationResult.valid
      ? 100
      : Math.max(0, 100 - validationResult.errors.length * 20 - validationResult.warnings.length * 5)
    : 0;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Validation Center
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Verify statement integrity before export.
          </p>
        </div>
        <button
          onClick={runValidation}
          disabled={!selectedReportId || running}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
            background: "#6366f1", color: "#fff", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 600,
            cursor: !selectedReportId || running ? "not-allowed" : "pointer",
            opacity: !selectedReportId || running ? 0.5 : 1,
          }}
        >
          <RefreshCw size={14} className={running ? "animate-spin" : ""} />
          {running ? "Running…" : "Run Validation"}
        </button>
      </div>

      {/* Report selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
          Report
        </label>
        {reportsLoading ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading reports…</div>
        ) : (
          <select
            value={selectedReportId}
            onChange={(e) => {
              setSelectedReportId(e.target.value);
              setValidationResult(null);
            }}
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

      {/* Empty state */}
      {!selectedReportId && (
        <div className="surface" style={{ padding: 40, textAlign: "center", borderRadius: 12 }}>
          <ShieldCheck size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Select a report and click "Run Validation".</p>
        </div>
      )}

      {/* No result yet */}
      {selectedReportId && !validationResult && !running && !runError && (
        <div className="surface" style={{ padding: 40, textAlign: "center", borderRadius: 12 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Click "Run Validation" to check this report.</p>
        </div>
      )}

      {/* Loading */}
      {running && (
        <div className="surface" style={{ padding: 40, textAlign: "center", borderRadius: 12 }}>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", animation: "pulse 1.5s infinite" }}>
            Running validation checks…
          </div>
        </div>
      )}

      {/* Error */}
      {runError && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8, padding: "12px 16px", marginBottom: 16,
        }}>
          <AlertCircle size={16} style={{ color: "#f87171" }} />
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{runError}</span>
        </div>
      )}

      {/* Results */}
      {validationResult && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary card */}
          <div className="surface" style={{ borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              {validationResult.valid
                ? <CheckCircle2 size={20} style={{ color: "#34d399" }} />
                : <XCircle size={20} style={{ color: "#f87171" }} />
              }
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                {validationResult.valid
                  ? "All checks passed — statement is ready for export"
                  : `${validationResult.errors.length} error${validationResult.errors.length !== 1 ? "s" : ""}, ${validationResult.warnings.length} warning${validationResult.warnings.length !== 1 ? "s" : ""} — statement is NOT ready for export`
                }
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 14px" }}>{validationResult.summary}</p>
            {/* Progress bar */}
            <div style={{ background: "var(--bg-elevated)", borderRadius: 4, height: 6, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${progressPct}%`,
                background: validationResult.valid ? "#34d399" : progressPct > 60 ? "#fbbf24" : "#f87171",
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
              {[
                { label: "Errors",   count: validationResult.errors.length,   color: "#f87171" },
                { label: "Warnings", count: validationResult.warnings.length, color: "#fbbf24" },
                { label: "Info",     count: validationResult.infos.length,    color: "#60a5fa" },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{count} {label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Issue groups */}
          {issueGroups.map(({ severity, items, label }) =>
            items.length === 0 ? null : (
              <div key={severity}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label} ({items.length})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.map((issue, i) => {
                    const c = SEV_COLORS[severity];
                    return (
                      <div
                        key={i}
                        style={{
                          background: c.bg, border: `1px solid ${c.border}`,
                          borderRadius: 8, padding: "10px 14px",
                          display: "flex", alignItems: "flex-start", gap: 10,
                        }}
                      >
                        <div style={{ marginTop: 1 }}>{SEV_ICON[severity]}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                              background: c.badge, color: c.text, fontFamily: "monospace",
                            }}>
                              {issue.code}
                            </span>
                            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                              {issue.message}
                            </span>
                          </div>
                          {issue.affectedKeys && issue.affectedKeys.length > 0 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                              {issue.affectedKeys.map((k) => (
                                <span key={k} style={{
                                  fontSize: 11, fontFamily: "monospace", padding: "1px 6px",
                                  background: "rgba(0,0,0,0.12)", borderRadius: 4,
                                  color: "var(--text-secondary)",
                                }}>
                                  {k}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {issue.code === "UNMAPPED_ACCOUNTS" && (
                          <button
                            onClick={() => router.push("/accounting/financial-statements/ledger-mapping")}
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              fontSize: 12, fontWeight: 600, color: c.text,
                              background: "none", border: `1px solid ${c.border}`,
                              borderRadius: 6, padding: "3px 8px", cursor: "pointer", flexShrink: 0,
                            }}
                          >
                            Fix <ExternalLink size={10} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Re-validate */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={runValidation}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={13} /> Re-validate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
