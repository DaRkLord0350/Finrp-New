"use client";

import React, { useState } from "react";
import { useQuery } from "@/lib/queryCache";
import { formatCurrency } from "@/lib/formatters/currency";
import { BarChart2, TrendingUp, TrendingDown, Minus } from "lucide-react";

type Report = {
  id: string;
  statementType: string;
  periodStart: string;
  periodEnd: string;
  comparativeStart?: string;
  comparativeEnd?: string;
};

type ComputedLineItem = {
  key: string;
  label: string;
  amount: number;
  comparativeAmount?: number;
  isSubtotal?: boolean;
  isTotal?: boolean;
  children?: ComputedLineItem[];
};

type ComputedReport = {
  reportId: string;
  statementType: string;
  periodStart: string;
  periodEnd: string;
  comparativeStart?: string;
  comparativeEnd?: string;
  currency: string;
  sections: ComputedLineItem[];
};

type DisplayMode = "amount" | "percent";

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function ChangeCell({ current, prior, mode }: { current: number; prior: number | undefined; mode: DisplayMode }) {
  if (prior === undefined) return <td style={{ padding: "8px 10px" }}>—</td>;
  const diff = current - prior;
  const pct = pctChange(current, prior);
  const isPos = diff > 0;
  const isNeg = diff < 0;
  const color = isPos ? "#34d399" : isNeg ? "#f87171" : "var(--text-muted)";

  return (
    <td style={{ padding: "8px 10px", textAlign: "right" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
        {isPos ? <TrendingUp size={12} style={{ color }} /> : isNeg ? <TrendingDown size={12} style={{ color }} /> : <Minus size={12} style={{ color }} />}
        <span style={{ fontSize: 13, fontWeight: 500, color }}>
          {mode === "percent"
            ? pct !== null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : "—"
            : `${diff >= 0 ? "+" : ""}${formatCurrency(diff)}`
          }
        </span>
      </div>
    </td>
  );
}

function ItemRow({ item, depth = 0, mode }: { item: ComputedLineItem; depth?: number; mode: DisplayMode }) {
  const isBold = item.isSubtotal || item.isTotal;
  const bg = item.isTotal ? "var(--bg-elevated)" : "transparent";

  return (
    <>
      <tr style={{ background: bg, borderTop: item.isTotal ? "1px solid var(--border-strong)" : undefined }}>
        <td style={{
          padding: "8px 10px", paddingLeft: `${10 + depth * 16}px`,
          fontSize: 13, color: "var(--text-primary)",
          fontWeight: isBold ? 700 : 400,
        }}>
          {item.label}
        </td>
        <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 13, fontWeight: isBold ? 700 : 400, color: "var(--text-primary)" }}>
          {formatCurrency(item.amount)}
        </td>
        <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 13, fontWeight: isBold ? 700 : 400, color: "var(--text-secondary)" }}>
          {item.comparativeAmount !== undefined ? formatCurrency(item.comparativeAmount) : "—"}
        </td>
        <ChangeCell current={item.amount} prior={item.comparativeAmount} mode={mode} />
      </tr>
      {item.children?.map((child) => (
        <ItemRow key={child.key} item={child} depth={depth + 1} mode={mode} />
      ))}
    </>
  );
}

function extractKPIs(sections: ComputedLineItem[], type: string) {
  const find = (key: string, items: ComputedLineItem[]): ComputedLineItem | undefined => {
    for (const it of items) {
      if (it.key === key) return it;
      if (it.children) {
        const f = find(key, it.children);
        if (f) return f;
      }
    }
    return undefined;
  };

  const revenue = sections.find((s) => s.key?.toLowerCase().includes("revenue") || s.label?.toLowerCase().includes("revenue"));
  const profit = sections.find((s) => s.key?.toLowerCase().includes("profit") || s.label?.toLowerCase().includes("profit") || s.isTotal);
  const assets = sections.find((s) => s.key?.toLowerCase().includes("asset") || s.label?.toLowerCase().includes("asset"));
  const equity = sections.find((s) => s.key?.toLowerCase().includes("equity") || s.label?.toLowerCase().includes("net worth") || s.label?.toLowerCase().includes("equity"));

  return [
    { label: "Revenue", item: revenue },
    { label: "Profit", item: profit },
    { label: "Total Assets", item: assets },
    { label: "Net Worth / Equity", item: equity },
  ].filter(({ item }) => item !== undefined) as Array<{ label: string; item: ComputedLineItem }>;
}

export default function ComparativePage() {
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [mode, setMode] = useState<DisplayMode>("amount");

  const { data: reports, isLoading: reportsLoading } = useQuery<Report[]>(
    ["fs-reports-list"],
    async () => {
      const r = await fetch("/api/financial-statements/reports");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }
  );

  const { data: snapshot, isLoading: snapshotLoading } = useQuery<ComputedReport>(
    ["fs-snapshot", selectedReportId],
    async () => {
      const r = await fetch(`/api/financial-statements/reports/${selectedReportId}/snapshot`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    { enabled: !!selectedReportId }
  );

  const selectedReport = (reports ?? []).find((r) => r.id === selectedReportId);
  const hasComparative = !!(selectedReport?.comparativeStart && selectedReport?.comparativeEnd);
  const kpis = snapshot ? extractKPIs(snapshot.sections, snapshot.statementType) : [];

  return (
    <div style={{ padding: 24, maxWidth: 1040, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Comparative Analysis
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Side-by-side current and prior period comparison.
          </p>
        </div>
        <div style={{ display: "flex", gap: 2, background: "var(--bg-elevated)", borderRadius: 8, padding: 3, border: "1px solid var(--border)" }}>
          {(["amount", "percent"] as DisplayMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: "none", cursor: "pointer",
                background: mode === m ? "#6366f1" : "transparent",
                color: mode === m ? "#fff" : "var(--text-secondary)",
              }}
            >
              {m === "amount" ? "₹ Change" : "% Change"}
            </button>
          ))}
        </div>
      </div>

      {/* Report selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
          Report (with comparative period)
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
              color: "var(--text-primary)", minWidth: 400,
            }}
          >
            <option value="">— Select a report —</option>
            {(reports ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.statementType} · {r.periodStart?.slice(0, 10)} → {r.periodEnd?.slice(0, 10)}
                {r.comparativeStart ? ` (vs ${r.comparativeStart?.slice(0, 10)})` : ""}
              </option>
            ))}
          </select>
        )}
        {selectedReport && !hasComparative && (
          <p style={{ fontSize: 12, color: "#fbbf24", marginTop: 6 }}>
            This report has no comparative period set. Edit the report to add a comparative date range.
          </p>
        )}
      </div>

      {/* Empty state */}
      {!selectedReportId && (
        <div className="surface" style={{ padding: 40, textAlign: "center", borderRadius: 12 }}>
          <BarChart2 size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Select a report to view comparative analysis.</p>
        </div>
      )}

      {/* Loading */}
      {snapshotLoading && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading snapshot…</div>
      )}

      {snapshot && (
        <>
          {/* KPI Cards */}
          {kpis.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
              {kpis.map(({ label, item }) => {
                const diff = item.comparativeAmount !== undefined ? item.amount - item.comparativeAmount : null;
                const isPos = diff !== null && diff > 0;
                const isNeg = diff !== null && diff < 0;
                const color = isPos ? "#34d399" : isNeg ? "#f87171" : "var(--text-muted)";
                return (
                  <div key={label} className="surface" style={{ borderRadius: 10, padding: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>{formatCurrency(item.amount)}</p>
                    {diff !== null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {isPos ? <TrendingUp size={12} style={{ color }} /> : isNeg ? <TrendingDown size={12} style={{ color }} /> : <Minus size={12} style={{ color }} />}
                        <span style={{ fontSize: 12, color, fontWeight: 600 }}>
                          {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>vs prior</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Comparison table */}
          <div className="surface" style={{ borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-strong)" }}>
                  <th style={{ textAlign: "left", padding: "10px 10px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Label
                  </th>
                  <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Current · {snapshot.periodEnd?.slice(0, 10)}
                  </th>
                  <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Prior · {snapshot.comparativeEnd?.slice(0, 10) ?? "—"}
                  </th>
                  <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {mode === "percent" ? "% Change" : "Change (₹)"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshot.sections.map((section) => (
                  <React.Fragment key={section.key}>
                    <tr style={{ background: "rgba(99,102,241,0.05)", borderTop: "2px solid var(--border)" }}>
                      <td colSpan={4} style={{ padding: "6px 10px", fontSize: 11, fontWeight: 800, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {section.label}
                      </td>
                    </tr>
                    {section.children
                      ? section.children.map((item) => <ItemRow key={item.key} item={item} mode={mode} />)
                      : <ItemRow key={section.key} item={section} mode={mode} />
                    }
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
