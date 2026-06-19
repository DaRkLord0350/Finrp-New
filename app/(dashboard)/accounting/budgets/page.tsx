"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, RefreshCw, PiggyBank, BarChart3, X } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface Budget {
  id: string;
  name: string;
  granularity: string;
  status: string;
  fiscalYear: { name: string };
  _count?: { lines: number };
}
interface FY { id: string; name: string }

const inputStyle: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "9px 12px", fontSize: 14, width: "100%", outline: "none" };
const labelStyle: React.CSSProperties = { color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, marginBottom: 6, display: "block" };

export default function BudgetsPage() {
  const { isMobile } = useBreakpoint();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [years, setYears] = useState<FY[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", fiscalYearId: "", granularity: "MONTHLY" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, yRes] = await Promise.all([fetch("/api/accounting/budgets"), fetch("/api/accounting/fiscal-years")]);
      const bData = await bRes.json();
      const yData = await yRes.json();
      if (!bRes.ok) throw new Error(bData.error ?? "Failed to load budgets");
      setBudgets(bData.budgets);
      setYears((yData.years ?? []).map((y: FY) => ({ id: y.id, name: y.name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.fiscalYearId) { setError("Select a fiscal year first."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting/budgets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      setShowForm(false);
      setForm({ name: "", fiscalYearId: "", granularity: "MONTHLY" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", marginBottom: 28, gap: 14 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Budgets</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>Plan income and expenses per account and period, then track actuals against plan.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} className="btn-ghost" style={{ padding: "8px 12px" }}><RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} /></button>
          <button onClick={() => setShowForm(true)} className="btn-brand" style={{ display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> New Budget</button>
        </div>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
        {!loading && budgets.length === 0 && <p style={{ color: "var(--text-muted)" }}>No budgets yet. Create one to get started.</p>}
        {budgets.map((b) => (
          <motion.div key={b.id} className="surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><PiggyBank size={16} color="var(--brand-400)" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{b.name}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{b.fiscalYear.name} · {b.granularity.toLowerCase()}</p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: b.status === "ACTIVE" ? "#10b981" : "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: 6 }}>{b.status}</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{b._count?.lines ?? 0} line(s)</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href={`/accounting/budgets/${b.id}`} className="btn-ghost" style={{ flex: 1, textAlign: "center", padding: "7px 0", fontSize: 13 }}>Edit</Link>
              <Link href={`/accounting/budgets/${b.id}/variance`} className="btn-ghost" style={{ flex: 1, textAlign: "center", padding: "7px 0", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><BarChart3 size={13} /> Variance</Link>
            </div>
          </motion.div>
        ))}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }} onClick={() => setShowForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>New Budget</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)" }}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div><label style={labelStyle}>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Operating Budget" style={inputStyle} /></div>
              <div><label style={labelStyle}>Fiscal Year *</label>
                <select value={form.fiscalYearId} onChange={(e) => setForm({ ...form, fiscalYearId: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">— Select —</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
                {years.length === 0 && <p style={{ fontSize: 12, color: "#f59e0b", marginTop: 6 }}>Create a fiscal year first.</p>}
              </div>
              <div><label style={labelStyle}>Granularity</label>
                <select value={form.granularity} onChange={(e) => setForm({ ...form, granularity: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ padding: "9px 18px" }}>Cancel</button>
                <button onClick={create} disabled={busy || years.length === 0} className="btn-brand" style={{ padding: "9px 18px", opacity: busy || years.length === 0 ? 0.6 : 1 }}>{busy ? "Creating…" : "Create"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
