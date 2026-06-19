"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, ShieldCheck, Save } from "lucide-react";
import { useAccountOptions } from "@/hooks/useChartOfAccounts";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface Settings {
  baseCurrency: string;
  lockDate: string | null;
  lockReason: string | null;
  retainedEarningsAccountId: string | null;
  forexGainLossAccountId: string | null;
  roundingAccountId: string | null;
}

const inputStyle: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "9px 12px", fontSize: 14, width: "100%", outline: "none" };
const labelStyle: React.CSSProperties = { color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, marginBottom: 6, display: "block" };

export default function PeriodLockingPage() {
  const { isMobile } = useBreakpoint();
  const { options } = useAccountOptions(false);
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounting/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setS({
        baseCurrency: data.baseCurrency,
        lockDate: data.lockDate ? String(data.lockDate).slice(0, 10) : null,
        lockReason: data.lockReason,
        retainedEarningsAccountId: data.retainedEarningsAccountId,
        forexGainLossAccountId: data.forexGainLossAccountId,
        roundingAccountId: data.roundingAccountId,
      });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/accounting/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCurrency: s.baseCurrency,
          lockDate: s.lockDate ? new Date(s.lockDate + "T23:59:59").toISOString() : null,
          lockReason: s.lockReason || null,
          retainedEarningsAccountId: s.retainedEarningsAccountId || null,
          forexGainLossAccountId: s.forexGainLossAccountId || null,
          roundingAccountId: s.roundingAccountId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setMsg({ type: "ok", text: "Settings saved." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const accountSelect = (value: string | null, onChange: (v: string) => void) => (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
      <option value="">— Not set —</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
    </select>
  );

  if (loading || !s) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Transaction Locking</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14, marginBottom: 24 }}>
        Lock the books through a date to prevent back-dated postings. Users with the <strong>accounting.manage</strong> permission can override the lock.
      </p>

      {msg && <div style={{ background: msg.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 8, padding: "10px 14px", color: msg.type === "ok" ? "#10b981" : "#ef4444", fontSize: 13, marginBottom: 16 }}>{msg.text}</div>}

      <motion.div className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 24, marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Lock size={16} color="var(--brand-400)" /> Books Lock Date</h3>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: 16 }}>
          <div><label style={labelStyle}>Locked through</label><input type="date" value={s.lockDate ?? ""} onChange={(e) => setS({ ...s, lockDate: e.target.value || null })} style={inputStyle} /></div>
          <div><label style={labelStyle}>Reason (optional)</label><input value={s.lockReason ?? ""} onChange={(e) => setS({ ...s, lockReason: e.target.value })} placeholder="e.g. FY 2025-26 filed" style={inputStyle} /></div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>Postings dated on or before this date are blocked. Leave empty to disable.</p>
      </motion.div>

      <motion.div className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={16} color="var(--brand-400)" /> System Account Mappings</h3>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
          <div><label style={labelStyle}>Retained Earnings</label>{accountSelect(s.retainedEarningsAccountId, (v) => setS({ ...s, retainedEarningsAccountId: v }))}</div>
          <div><label style={labelStyle}>Forex Gain / Loss</label>{accountSelect(s.forexGainLossAccountId, (v) => setS({ ...s, forexGainLossAccountId: v }))}</div>
          <div><label style={labelStyle}>Rounding Off</label>{accountSelect(s.roundingAccountId, (v) => setS({ ...s, roundingAccountId: v }))}</div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>Used by year-end closing and currency revaluation. Defaults resolve to codes 3100 / 4900 / 5950 when unset.</p>
      </motion.div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={saving} className="btn-brand" style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", opacity: saving ? 0.6 : 1 }}><Save size={15} /> {saving ? "Saving…" : "Save Settings"}</button>
      </div>
    </div>
  );
}
