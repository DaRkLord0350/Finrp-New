"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { useQuery } from "@/lib/queryCache";
import { useAccountOptions } from "@/hooks/useChartOfAccounts";
import { formatCurrency } from "@/lib/formatters/currency";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import ReportExporter from "@/app/(dashboard)/reports/ReportExporter";
import type { ReportResult, ReportColumn } from "@/lib/reports/types";

interface AccountingReportViewProps {
  slug: string;
  title: string;
  description: string;
  /** "range" shows start+end; "asof" emphasises a single as-of date. */
  mode: "range" | "asof";
  /** Show a per-account filter (General Ledger). */
  supportsAccount?: boolean;
}

const PRESETS = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "custom", label: "Custom" },
];

const controlStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  padding: "7px 10px",
  fontSize: 13,
  outline: "none",
};

export function AccountingReportView({ slug, title, description, mode, supportsAccount }: AccountingReportViewProps) {
  const { isMobile } = useBreakpoint();
  const { options } = useAccountOptions(false);

  const [preset, setPreset] = useState("this_year");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [accountId, setAccountId] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (preset === "custom") {
      if (startDate) p.set("startDate", new Date(startDate).toISOString());
      if (endDate) p.set("endDate", new Date(endDate + "T23:59:59").toISOString());
    } else {
      p.set("preset", preset);
    }
    if (supportsAccount && accountId) p.set("accountId", accountId);
    return p.toString();
  }, [preset, startDate, endDate, accountId, supportsAccount]);

  const { data, isLoading } = useQuery<ReportResult>(
    ["accounting-report", slug, query],
    async () => {
      const res = await fetch(`/api/reports/${slug}?${query}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    { staleTime: 15_000 }
  );

  const balanced = data?.summary?.balanced;
  const difference = Number(data?.summary?.difference ?? 0);
  const showBalance = data?.summary?.balanced !== undefined;

  const renderCell = (col: ReportColumn, row: Record<string, unknown>) => {
    const val = row[col.key];
    if (col.type === "currency") return formatCurrency(Number(val ?? 0));
    if (col.type === "badge") return (
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: 6 }}>{String(val ?? "")}</span>
    );
    if (col.type === "date" && val) return new Date(String(val)).toLocaleDateString("en-IN");
    return val === null || val === undefined || val === "" ? "—" : String(val);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: 14, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{title}</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>{description}</p>
        </div>
        {data && <ReportExporter data={data} slug={slug} />}
      </div>

      {/* Filters */}
      <div className="surface" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "12px 16px", marginBottom: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{mode === "asof" ? "As of period" : "Period"}</span>
        <select value={preset} onChange={(e) => setPreset(e.target.value)} style={{ ...controlStyle, cursor: "pointer" }}>
          {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {preset === "custom" && (
          <>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={controlStyle} />
            <span style={{ color: "var(--text-muted)" }}>→</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={controlStyle} />
          </>
        )}
        {supportsAccount && (
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ ...controlStyle, cursor: "pointer", minWidth: 200 }}>
            <option value="">All accounts</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
          </select>
        )}
        {isLoading && <RefreshCw size={14} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />}
      </div>

      {/* Balanced banner */}
      {showBalance && data && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", marginBottom: 16, borderRadius: 10,
          border: `1px solid ${balanced ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.35)"}`,
          background: balanced ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
        }}>
          {balanced ? <CheckCircle2 size={16} color="#10b981" /> : <AlertTriangle size={16} color="#ef4444" />}
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {balanced ? "In balance" : `Out of balance by ${formatCurrency(Math.abs(difference))}`}
          </span>
        </div>
      )}

      {/* Summary chips */}
      {data?.summary && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          {Object.entries(data.summary)
            .filter(([k]) => !["balanced"].includes(k))
            .slice(0, 4)
            .map(([k, v]) => (
              <div key={k} className="surface" style={{ padding: "12px 16px" }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
                  {typeof v === "number" && /total|debit|credit|amount|asset|liab|equity|income|expense|profit|difference|revenue|cash/i.test(k) ? formatCurrency(v) : String(v)}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* Table */}
      <div className="surface" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {data?.columns.map((c) => (
                  <th key={c.key} style={{ padding: "12px 20px", fontWeight: 600, textAlign: c.align ?? "left" }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={data?.columns.length ?? 4} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>
              )}
              {!isLoading && data && data.rows.length === 0 && (
                <tr><td colSpan={data.columns.length} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No data for this period.</td></tr>
              )}
              {!isLoading && data?.rows.map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  {data.columns.map((c) => (
                    <td key={c.key} style={{ padding: "10px 20px", color: "var(--text-secondary)", textAlign: c.align ?? "left" }}>
                      {renderCell(c, row as Record<string, unknown>)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {data?.totals && data.rows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: "1px solid var(--border-strong)", background: "var(--bg-elevated)", fontWeight: 700 }}>
                  {data.columns.map((c, idx) => {
                    const totalVal = data.totals?.[c.key];
                    return (
                      <td key={c.key} style={{ padding: "12px 20px", textAlign: c.align ?? "left", color: "var(--text-primary)" }}>
                        {idx === 0 ? "Total" : totalVal !== undefined ? formatCurrency(Number(totalVal)) : ""}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
