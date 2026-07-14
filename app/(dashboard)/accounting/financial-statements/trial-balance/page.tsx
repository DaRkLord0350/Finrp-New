"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw, Download, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";

type Preset = "this_month" | "last_month" | "this_quarter" | "this_year" | "last_year" | "custom";

interface TBAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  debit: number;
  credit: number;
  netBalance: number;
}

interface TBGroup {
  type: string;
  accounts: TBAccount[];
  totalDebit: number;
  totalCredit: number;
  totalNet: number;
}

interface TrialBalanceData {
  groups: TBGroup[];
  totalDebit: number;
  totalCredit: number;
  difference: number;
  balanced: boolean;
  asOf: string;
  preset: string;
}

const TYPE_ORDER = ["ASSET", "BANK", "CASH", "LIABILITY", "EQUITY", "INCOME", "EXPENSE", "COGS"];
const TYPE_COLOR: Record<string, string> = {
  ASSET: "#6366f1", BANK: "#3b82f6", CASH: "#06b6d4",
  LIABILITY: "#f59e0b", EQUITY: "#a78bfa",
  INCOME: "#10b981", EXPENSE: "#ef4444", COGS: "#f97316",
};

const PRESET_LABELS: Record<Preset, string> = {
  this_month: "This Month", last_month: "Last Month",
  this_quarter: "This Quarter", this_year: "This Year",
  last_year: "Last Year", custom: "Custom Range",
};

export default function TrialBalancePage() {
  const [preset, setPreset] = useState<Preset>("this_year");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ preset });
      if (preset === "custom" && customStart && customEnd) {
        params.set("startDate", customStart);
        params.set("endDate", customEnd);
      }
      const res = await fetch(`/api/financial-statements/trial-balance?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load trial balance");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => { load(); }, [load]);

  const toggleGroup = (type: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const sortedGroups = data
    ? [...data.groups].sort((a, b) => {
        const ai = TYPE_ORDER.indexOf(a.type);
        const bi = TYPE_ORDER.indexOf(b.type);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
    : [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Trial Balance</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            Debit and credit totals for every account, grouped by type.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
          >
            {(Object.entries(PRESET_LABELS) as [Preset, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {preset === "custom" && (
            <>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px", fontSize: 13 }} />
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px", fontSize: 13 }} />
            </>
          )}
          <button onClick={load} className="btn-ghost" style={{ padding: "8px 12px" }} title="Refresh">
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px" }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Debit",    value: data ? formatCurrency(data.totalDebit)  : "—", color: "#6366f1" },
          { label: "Total Credit",   value: data ? formatCurrency(data.totalCredit) : "—", color: "#10b981" },
          { label: "Difference",     value: data ? formatCurrency(data.difference)  : "—", color: Math.abs(data?.difference ?? 1) < 0.01 ? "#9ca3af" : "#ef4444" },
          { label: "Balance Status", value: data ? (data.balanced ? "Balanced" : "Unbalanced") : "—", color: data?.balanced ? "#10b981" : "#ef4444" },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ padding: "18px 20px" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              {s.label === "Balance Status" && data && (
                data.balanced
                  ? <CheckCircle2 size={16} color="#10b981" />
                  : <AlertTriangle size={16} color="#ef4444" />
              )}
              <p style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{loading ? "…" : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <motion.div className="surface" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ display: "inline-block", width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--brand-400)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12 }}>Loading trial balance…</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)", textAlign: "left" }}>
                  {["Account Code", "Account Name", "Type", "Debit", "Credit", "Net Balance"].map((h, i) => (
                    <th key={h} style={{ padding: "10px 16px", fontWeight: 600, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i >= 3 ? "right" : "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedGroups.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No accounts with balances in this period.</td></tr>
                )}
                {sortedGroups.map((group) => {
                  const isCollapsed = collapsed.has(group.type);
                  const color = TYPE_COLOR[group.type] ?? "#9ca3af";
                  return [
                    <tr key={`group-${group.type}`} onClick={() => toggleGroup(group.type)}
                      style={{ background: `${color}0d`, cursor: "pointer", userSelect: "none" }}>
                      <td colSpan={2} style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isCollapsed ? <ChevronRight size={14} color={color} /> : <ChevronDown size={14} color={color} />}
                          <span style={{ fontWeight: 700, color, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>{group.type}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({group.accounts.length} accounts)</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px" }} />
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color }}>{formatCurrency(group.totalDebit)}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color }}>{formatCurrency(group.totalCredit)}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color }}>{formatCurrency(group.totalNet)}</td>
                    </tr>,
                    ...(!isCollapsed ? group.accounts.map((acc) => (
                      <tr key={acc.id} className="row-hover" style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 16px 10px 36px", color: "var(--text-muted)", fontFamily: "monospace" }}>{acc.code}</td>
                        <td style={{ padding: "10px 16px", color: "var(--text-primary)", fontWeight: 500 }}>{acc.name}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ fontSize: 11, color, background: `${color}18`, padding: "2px 7px", borderRadius: 5, fontWeight: 600 }}>{acc.accountType}</span>
                        </td>
                        <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--text-secondary)" }}>{formatCurrency(acc.debit)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--text-secondary)" }}>{formatCurrency(acc.credit)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: acc.netBalance >= 0 ? "var(--text-primary)" : "#ef4444" }}>{formatCurrency(acc.netBalance)}</td>
                      </tr>
                    )) : []),
                  ];
                })}
              </tbody>
              {data && (
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border-strong)", background: "var(--bg-elevated)" }}>
                    <td colSpan={3} style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>TOTAL</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>{formatCurrency(data.totalDebit)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>{formatCurrency(data.totalCredit)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: Math.abs(data.difference) < 0.01 ? "#10b981" : "#ef4444", fontSize: 13 }}>
                      {data.balanced ? "✓ Balanced" : formatCurrency(data.difference)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </motion.div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .row-hover:hover { background: var(--bg-elevated); }
      `}</style>
    </div>
  );
}
