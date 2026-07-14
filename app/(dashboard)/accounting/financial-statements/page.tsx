"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus, RefreshCw, FileText, Scale, TrendingUp, Droplets,
  CheckCircle2, AlertTriangle, X, BarChart3, ArrowUpRight,
} from "lucide-react";

type StatementType = "BALANCE_SHEET" | "PROFIT_LOSS" | "CASH_FLOW" | "NOTES_ACCOUNTS";
type ReportStatus = "DRAFT" | "REVIEW" | "APPROVED" | "LOCKED" | "PUBLISHED";
type ReportCategory = "CORPORATE" | "NON_CORPORATE";

interface Report {
  id: string;
  name: string;
  statementType: StatementType;
  fiscalYearId: string;
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  category: ReportCategory;
  createdAt: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
}

const STATUS_COLOR: Record<ReportStatus, { fg: string; bg: string }> = {
  DRAFT:     { fg: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
  REVIEW:    { fg: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  APPROVED:  { fg: "#10b981", bg: "rgba(16,185,129,0.12)" },
  LOCKED:    { fg: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  PUBLISHED: { fg: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
};

const TYPE_LABEL: Record<StatementType, string> = {
  BALANCE_SHEET:  "Balance Sheet",
  PROFIT_LOSS:    "Profit & Loss",
  CASH_FLOW:      "Cash Flow",
  NOTES_ACCOUNTS: "Notes to Accounts",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  padding: "9px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};
const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500,
  marginBottom: 6,
  display: "block",
};

function StatusBadge({ status }: { status: ReportStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: c.fg, background: c.bg, padding: "2px 8px", borderRadius: 6 }}>
      {status}
    </span>
  );
}

export default function FinancialStatementsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const [form, setForm] = useState({
    statementType: "BALANCE_SHEET" as StatementType,
    fiscalYearId: "",
    periodStart: "",
    periodEnd: "",
    category: "CORPORATE" as ReportCategory,
    name: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/financial-statements/reports");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setReports(data.reports ?? data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name || !form.periodStart || !form.periodEnd) {
      setError("Name, period start and period end are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/financial-statements/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      setShowForm(false);
      setForm({ statementType: "BALANCE_SHEET", fiscalYearId: "", periodStart: "", periodEnd: "", category: "CORPORATE", name: "" });
      await load();
      if (data.id) {
        const paths: Record<StatementType, string> = {
          BALANCE_SHEET:  `/accounting/financial-statements/balance-sheet`,
          PROFIT_LOSS:    `/accounting/financial-statements/profit-loss`,
          CASH_FLOW:      `/accounting/financial-statements/cash-flow`,
          NOTES_ACCOUNTS: `/accounting/financial-statements/notes`,
        };
        router.push(paths[form.statementType]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  const counts = {
    bs:      reports.filter((r) => r.statementType === "BALANCE_SHEET").length,
    pl:      reports.filter((r) => r.statementType === "PROFIT_LOSS").length,
    cf:      reports.filter((r) => r.statementType === "CASH_FLOW").length,
    draft:   reports.filter((r) => r.status === "DRAFT").length,
  };

  const recent = [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

  const quickActions = [
    { label: "New Balance Sheet",  type: "BALANCE_SHEET"  as StatementType, icon: Scale,      color: "#6366f1" },
    { label: "New P&L Statement",  type: "PROFIT_LOSS"    as StatementType, icon: TrendingUp, color: "#10b981" },
    { label: "New Cash Flow",      type: "CASH_FLOW"      as StatementType, icon: Droplets,   color: "#3b82f6" },
    { label: "Manage Notes",       type: "NOTES_ACCOUNTS" as StatementType, icon: FileText,   color: "#f59e0b" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Financial Statements</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            Schedule III compliant financial statements — Balance Sheet, P&L, Cash Flow, Notes.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} className="btn-ghost" style={{ padding: "8px 12px" }} title="Refresh">
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button onClick={() => setShowForm(true)} className="btn-brand" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> New Statement
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Balance Sheets",  value: counts.bs,    icon: Scale,      color: "#6366f1" },
          { label: "P&L Statements",  value: counts.pl,    icon: TrendingUp, color: "#10b981" },
          { label: "Cash Flow Stmts", value: counts.cf,    icon: Droplets,   color: "#3b82f6" },
          { label: "Draft Statements",value: counts.draft, icon: FileText,   color: "#f59e0b" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} className="stat-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
                <Icon size={15} color={s.color} />
              </div>
              <p style={{ fontSize: 26, fontWeight: 700, color: s.color, marginTop: 8 }}>{loading ? "…" : s.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 20 }}>
        {/* Recent Statements */}
        <div className="surface" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart3 size={16} color="var(--brand-400)" />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Recent Statements</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{reports.length} total</p>
            </div>
          </div>
          <div>
            {loading && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
            )}
            {!loading && recent.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No statements yet. Create your first one above.
              </div>
            )}
            {!loading && recent.map((r) => (
              <div key={r.id} style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                className="row-hover"
                onClick={() => {
                  const paths: Record<StatementType, string> = {
                    BALANCE_SHEET: "/accounting/financial-statements/balance-sheet",
                    PROFIT_LOSS: "/accounting/financial-statements/profit-loss",
                    CASH_FLOW: "/accounting/financial-statements/cash-flow",
                    NOTES_ACCOUNTS: "/accounting/financial-statements/notes",
                  };
                  router.push(paths[r.statementType]);
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name || TYPE_LABEL[r.statementType]}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {new Date(r.periodStart).toLocaleDateString("en-IN")} — {new Date(r.periodEnd).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 7px", borderRadius: 5 }}>
                    {TYPE_LABEL[r.statementType]}
                  </span>
                  <StatusBadge status={r.status} />
                  <ArrowUpRight size={13} color="var(--text-muted)" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions + Validation */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="surface" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Quick Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {quickActions.map((a) => {
                const Icon = a.icon;
                const paths: Record<StatementType, string> = {
                  BALANCE_SHEET: "/accounting/financial-statements/balance-sheet",
                  PROFIT_LOSS: "/accounting/financial-statements/profit-loss",
                  CASH_FLOW: "/accounting/financial-statements/cash-flow",
                  NOTES_ACCOUNTS: "/accounting/financial-statements/notes",
                };
                return (
                  <button key={a.type} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", textAlign: "left" }}
                    onClick={() => router.push(paths[a.type])}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: `${a.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={14} color={a.color} />
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{a.label}</span>
                  </button>
                );
              })}
              <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", textAlign: "left" }}
                onClick={() => router.push("/accounting/financial-statements/ledger-mapping")}
              >
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(167,139,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Scale size={14} color="#a78bfa" />
                </div>
                <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>AI Ledger Mapping</span>
              </button>
              <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", textAlign: "left" }}
                onClick={() => router.push("/accounting/financial-statements/trial-balance")}
              >
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <BarChart3 size={14} color="#3b82f6" />
                </div>
                <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>Trial Balance</span>
              </button>
            </div>
          </div>

          {/* Validation Status */}
          <div className="surface" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Validation Status</h3>
            {validation ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  {validation.valid
                    ? <CheckCircle2 size={16} color="#10b981" />
                    : <AlertTriangle size={16} color="#ef4444" />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: validation.valid ? "#10b981" : "#ef4444" }}>
                    {validation.valid ? "All checks passed" : `${validation.errors.length} error(s)`}
                  </span>
                </div>
                {validation.errors.map((e, i) => (
                  <p key={i} style={{ fontSize: 12, color: "#ef4444", marginBottom: 4 }}>• {e}</p>
                ))}
                {validation.warnings.map((w, i) => (
                  <p key={i} style={{ fontSize: 12, color: "#f59e0b", marginBottom: 4 }}>⚠ {w}</p>
                ))}
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                  Checked {new Date(validation.checkedAt).toLocaleTimeString("en-IN")}
                </p>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <AlertTriangle size={28} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Open a statement and click Validate to run checks.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Statement Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
          onClick={() => setShowForm(false)}
        >
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>New Financial Statement</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={16} />
              </button>
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Statement Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. FY 2024-25 Balance Sheet" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Statement Type *</label>
                <select value={form.statementType} onChange={(e) => setForm({ ...form, statementType: e.target.value as StatementType })} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="BALANCE_SHEET">Balance Sheet</option>
                  <option value="PROFIT_LOSS">Profit & Loss</option>
                  <option value="CASH_FLOW">Cash Flow Statement</option>
                  <option value="NOTES_ACCOUNTS">Notes to Accounts</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ReportCategory })} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="CORPORATE">Corporate (Schedule III)</option>
                  <option value="NON_CORPORATE">Non-Corporate</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Fiscal Year ID</label>
                <input value={form.fiscalYearId} onChange={(e) => setForm({ ...form, fiscalYearId: e.target.value })} placeholder="e.g. fiscal-year-id" style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Period Start *</label>
                  <input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Period End *</label>
                  <input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ padding: "9px 18px" }}>Cancel</button>
                <button onClick={create} disabled={busy} className="btn-brand" style={{ padding: "9px 18px", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Creating…" : "Create Statement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .row-hover:hover { background: var(--bg-elevated); }
      `}</style>
    </div>
  );
}
