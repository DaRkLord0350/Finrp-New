"use client";

import { useState } from "react";
import { useQuery } from "@/lib/queryCache";
import { GitBranch, Lock, Eye, X, GitCompare } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";

type Report = {
  id: string;
  statementType: string;
  periodStart: string;
  periodEnd: string;
};

type VersionSection = {
  key: string;
  label: string;
  amount: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  children?: VersionSection[];
};

type ReportVersion = {
  id: string;
  version: number;
  versionLabel?: string;
  createdAt: string;
  changedById?: string;
  isLocked: boolean;
  snapshot?: {
    data?: {
      sections?: VersionSection[];
      statementType?: string;
    };
  };
};

function getSummaryValue(version: ReportVersion): { label: string; value: number } | null {
  const sections = version.snapshot?.data?.sections;
  const type = version.snapshot?.data?.statementType;
  if (!sections || sections.length === 0) return null;

  if (type === "BALANCE_SHEET") {
    const assets = sections.find((s) => s.key?.toLowerCase().includes("asset") || s.label?.toLowerCase().includes("asset"));
    if (assets) return { label: "Total Assets", value: assets.amount };
  }
  if (type === "PROFIT_LOSS") {
    const profit = sections.find((s) => s.isTotal === true || s.key?.toLowerCase().includes("profit") || s.label?.toLowerCase().includes("profit"));
    if (profit) return { label: "Net Profit", value: profit.amount };
  }
  // fallback: first total section
  const total = sections.find((s) => s.isTotal === true);
  return total ? { label: total.label, value: total.amount } : { label: sections[0].label, value: sections[0].amount };
}

type DiffRow = { key: string; label: string; vA: number | undefined; vB: number | undefined; changed: boolean };

function computeDiff(vA: ReportVersion, vB: ReportVersion): DiffRow[] {
  const sectionsA = vA.snapshot?.data?.sections ?? [];
  const sectionsB = vB.snapshot?.data?.sections ?? [];

  const flatten = (sections: typeof sectionsA): Map<string, { key: string; label: string; amount: number }> => {
    const m = new Map<string, { key: string; label: string; amount: number }>();
    const walk = (items: typeof sections) => {
      for (const it of items) {
        m.set(it.key, it);
        if (it.children) walk(it.children as typeof sections);
      }
    };
    walk(sections);
    return m;
  };

  const mapA = flatten(sectionsA);
  const mapB = flatten(sectionsB);
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  const rows: DiffRow[] = [];

  for (const key of allKeys) {
    const a = mapA.get(key);
    const b = mapB.get(key);
    const amtA = a?.amount;
    const amtB = b?.amount;
    rows.push({
      key,
      label: a?.label ?? b?.label ?? key,
      vA: amtA,
      vB: amtB,
      changed: amtA !== amtB,
    });
  }
  return rows.filter((r) => r.changed);
}

export default function VersionsPage() {
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [viewingVersion, setViewingVersion] = useState<ReportVersion | null>(null);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const [showCompare, setShowCompare] = useState(false);

  const { data: reports, isLoading: reportsLoading } = useQuery<Report[]>(
    ["fs-reports-list"],
    async () => {
      const r = await fetch("/api/financial-statements/reports");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }
  );

  const { data: versions, isLoading: versionsLoading } = useQuery<ReportVersion[]>(
    ["fs-versions", selectedReportId],
    async () => {
      const r = await fetch(`/api/financial-statements/reports/${selectedReportId}/versions`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    { enabled: !!selectedReportId }
  );

  const list = versions ?? [];

  const versionA = list.find((v) => v.id === compareA);
  const versionB = list.find((v) => v.id === compareB);
  const diffRows = versionA && versionB ? computeDiff(versionA, versionB) : [];

  function renderSnapshotTable(version: ReportVersion) {
    const sections = version.snapshot?.data?.sections ?? [];
    if (sections.length === 0) {
      return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No snapshot data available.</p>;
    }
    const rows: Array<{ label: string; amount: number; depth: number; isBold: boolean }> = [];
    const walk = (items: typeof sections, depth: number) => {
      for (const it of items) {
        rows.push({ label: it.label, amount: it.amount, depth, isBold: !!(it as { isSubtotal?: boolean; isTotal?: boolean }).isTotal || !!(it as { isSubtotal?: boolean }).isSubtotal });
        if (it.children) walk(it.children as typeof sections, depth + 1);
      }
    };
    walk(sections, 0);
    return (
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--bg-elevated)" }}>
            <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Label</th>
            <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--border)", background: row.isBold ? "var(--bg-elevated)" : "transparent" }}>
              <td style={{ padding: "6px 10px", paddingLeft: `${10 + row.depth * 14}px`, fontSize: 13, color: "var(--text-primary)", fontWeight: row.isBold ? 700 : 400 }}>
                {row.label}
              </td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 13, color: "var(--text-primary)", fontWeight: row.isBold ? 700 : 400 }}>
                {formatCurrency(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 920, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Version History
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Track changes across statement versions over time.
          </p>
        </div>
        {list.length >= 2 && (
          <button
            onClick={() => setShowCompare(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <GitCompare size={14} /> Compare Versions
          </button>
        )}
      </div>

      {/* Report selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Report</label>
        {reportsLoading ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading reports…</div>
        ) : (
          <select
            value={selectedReportId}
            onChange={(e) => { setSelectedReportId(e.target.value); setViewingVersion(null); }}
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
          <GitBranch size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Select a report to view its version history.</p>
        </div>
      )}

      {/* Loading */}
      {versionsLoading && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading versions…</div>
      )}

      {/* Timeline */}
      {!versionsLoading && selectedReportId && list.length === 0 && (
        <div className="surface" style={{ padding: 40, textAlign: "center", borderRadius: 12 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No versions recorded yet.</p>
        </div>
      )}

      {list.length > 0 && (
        <div style={{ position: "relative" }}>
          {/* Timeline bar */}
          <div style={{
            position: "absolute", left: 19, top: 0, bottom: 0, width: 2,
            background: "var(--border)", zIndex: 0,
          }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map((v) => {
              const summary = getSummaryValue(v);
              return (
                <div key={v.id} style={{ display: "flex", gap: 16, position: "relative", zIndex: 1 }}>
                  {/* Dot */}
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 14,
                    background: v.isLocked ? "#fbbf24" : "#6366f1",
                    border: "2px solid var(--bg-card)",
                    boxShadow: "0 0 0 2px " + (v.isLocked ? "#fbbf24" : "#6366f1") + "33",
                  }} />
                  <div className="surface" style={{ flex: 1, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                        v{v.version}
                        {v.versionLabel && (
                          <span style={{ fontWeight: 500, color: "var(--text-secondary)", marginLeft: 6 }}>· {v.versionLabel}</span>
                        )}
                      </span>
                      {v.isLocked && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
                          background: "rgba(245,158,11,0.15)", color: "#fbbf24",
                        }}>
                          <Lock size={10} /> Locked
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(v.createdAt).toLocaleString()}
                      </span>
                      <button
                        onClick={() => setViewingVersion(v)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
                          background: "var(--bg-elevated)", border: "1px solid var(--border)",
                          borderRadius: 6, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
                          cursor: "pointer",
                        }}
                      >
                        <Eye size={11} /> View
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                      {v.changedById && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>By: {v.changedById}</span>
                      )}
                      {summary && (
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {summary.label}: <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(summary.value)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View Version Modal */}
      {viewingVersion && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div className="surface" style={{ width: 680, maxHeight: "88vh", overflowY: "auto", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  Version {viewingVersion.version}
                  {viewingVersion.versionLabel ? ` — ${viewingVersion.versionLabel}` : ""}
                </h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                  {new Date(viewingVersion.createdAt).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setViewingVersion(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>
            {renderSnapshotTable(viewingVersion)}
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompare && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div className="surface" style={{ width: 760, maxHeight: "88vh", overflowY: "auto", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Compare Versions</h2>
              <button onClick={() => { setShowCompare(false); setCompareA(""); setCompareB(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {[{ label: "Version A", value: compareA, set: setCompareA }, { label: "Version B", value: compareB, set: setCompareB }].map(({ label, value, set }) => (
                <div key={label} style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>{label}</label>
                  <select
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text-primary)" }}
                  >
                    <option value="">— Select —</option>
                    {list.map((v) => (
                      <option key={v.id} value={v.id}>v{v.version}{v.versionLabel ? ` — ${v.versionLabel}` : ""}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {compareA && compareB && compareA !== compareB && (
              <>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
                  {diffRows.length === 0 ? "No differences found." : `${diffRows.length} key(s) changed:`}
                </p>
                {diffRows.length > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-elevated)" }}>
                        {["Label", "Version A", "Version B", "Δ Amount"].map((h) => (
                          <th key={h} style={{ textAlign: h === "Label" ? "left" : "right", padding: "7px 10px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {diffRows.map((row) => {
                        const diff = (row.vB ?? 0) - (row.vA ?? 0);
                        const color = diff > 0 ? "#34d399" : diff < 0 ? "#f87171" : "var(--text-muted)";
                        return (
                          <tr key={row.key} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "7px 10px", fontSize: 13, color: "var(--text-primary)" }}>{row.label}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>{row.vA !== undefined ? formatCurrency(row.vA) : "—"}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>{row.vB !== undefined ? formatCurrency(row.vB) : "—"}</td>
                            <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 13, fontWeight: 600, color }}>{diff >= 0 ? "+" : ""}{formatCurrency(diff)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}
            {compareA === compareB && compareA !== "" && (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Select two different versions to compare.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
