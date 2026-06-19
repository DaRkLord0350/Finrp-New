"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, RefreshCw, Lock, Unlock, CalendarRange, X } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { formatCurrency } from "@/lib/formatters/currency";

interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
  _count?: { periods: number };
}

function defaultFY() {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    name: `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
    startDate: `${startYear}-04-01`,
    endDate: `${startYear + 1}-03-31`,
  };
}

const inputStyle: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "9px 12px", fontSize: 14, width: "100%", outline: "none" };
const labelStyle: React.CSSProperties = { color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, marginBottom: 6, display: "block" };

export default function FiscalYearsPage() {
  const { isMobile } = useBreakpoint();
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultFY());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounting/fiscal-years");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setYears(data.years);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting/fiscal-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      setShowForm(false);
      setForm(defaultFY());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  const closeYear = async (fy: FiscalYear) => {
    setError(null);
    try {
      const preview = await fetch(`/api/accounting/fiscal-years/${fy.id}/close`).then((r) => r.json());
      const ni = Number(preview.netIncome ?? 0);
      const msg = `Close "${fy.name}"?\n\nThis posts a closing journal that zeroes ${preview.lineCount} P&L account(s) into Retained Earnings (net ${ni >= 0 ? "income" : "loss"} ${formatCurrency(Math.abs(ni))}) and locks all periods.`;
      if (!confirm(msg)) return;
      setBusy(true);
      const res = await fetch(`/api/accounting/fiscal-years/${fy.id}/close`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to close");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close");
    } finally {
      setBusy(false);
    }
  };

  const reopenYear = async (fy: FiscalYear) => {
    if (!confirm(`Reopen "${fy.name}"? Periods will be unlocked. The closing journal stays in place — reverse it manually if needed.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/fiscal-years/${fy.id}/reopen`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reopen");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", marginBottom: 28, gap: 14 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Fiscal Years</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>Open and close accounting years; year-end closing carries net income to Retained Earnings.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} className="btn-ghost" style={{ padding: "8px 12px" }}><RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} /></button>
          <button onClick={() => setShowForm(true)} className="btn-brand" style={{ display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> New Fiscal Year</button>
        </div>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <motion.div className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={th}>Name</th><th style={th}>Period</th><th style={th}>Months</th><th style={th}>Status</th><th style={{ ...th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>}
            {!loading && years.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No fiscal years yet.</td></tr>}
            {!loading && years.map((fy) => (
              <tr key={fy.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600, color: "var(--text-primary)" }}><CalendarRange size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--text-muted)" }} />{fy.name}</td>
                <td style={td}>{new Date(fy.startDate).toLocaleDateString("en-IN")} – {new Date(fy.endDate).toLocaleDateString("en-IN")}</td>
                <td style={td}>{fy._count?.periods ?? "—"}</td>
                <td style={td}><span style={{ fontSize: 11, fontWeight: 700, color: fy.status === "OPEN" ? "#10b981" : "#f59e0b", background: fy.status === "OPEN" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", padding: "2px 8px", borderRadius: 6 }}>{fy.status}</span></td>
                <td style={{ ...td, textAlign: "right" }}>
                  {fy.status === "OPEN" ? (
                    <button onClick={() => closeYear(fy)} disabled={busy} className="btn-ghost" style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}><Lock size={13} /> Close Year</button>
                  ) : (
                    <button onClick={() => reopenYear(fy)} disabled={busy} className="btn-ghost" style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}><Unlock size={13} /> Reopen</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }} onClick={() => setShowForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 460, boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>New Fiscal Year</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)" }}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={labelStyle}>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={labelStyle}>Start Date *</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>End Date *</label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={inputStyle} /></div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Monthly periods are generated automatically across this range.</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ padding: "9px 18px" }}>Cancel</button>
                <button onClick={create} disabled={busy} className="btn-brand" style={{ padding: "9px 18px", opacity: busy ? 0.6 : 1 }}>{busy ? "Creating…" : "Create"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const th: React.CSSProperties = { padding: "12px 20px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "12px 20px", color: "var(--text-secondary)" };
