"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, Plus, Trash2, RefreshCw, Calculator } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { formatCurrency } from "@/lib/formatters/currency";

interface Rate { id: string; baseCurrency: string; targetCurrency: string; rate: string; asOfDate: string; source: string | null }
interface Reval { id: string; asOfDate: string; baseCurrency: string; status: string; totalGainLoss: string; _count?: { lines: number } }
interface PreviewLine { accountCode: string; accountName: string; currency: string; foreignBalance: number; newRate: number; baseBefore: number; baseAfter: number; gainLoss: number }
interface Preview { baseCurrency: string; lines: PreviewLine[]; totalGainLoss: number }

const inputStyle: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px", fontSize: 13, outline: "none" };
const th: React.CSSProperties = { padding: "10px 16px", fontWeight: 600, textAlign: "left" as const };
const td: React.CSSProperties = { padding: "10px 16px", color: "var(--text-secondary)" };

export default function CurrencyPage() {
  const { isMobile } = useBreakpoint();
  const [rates, setRates] = useState<Rate[]>([]);
  const [revals, setRevals] = useState<Reval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const [rateForm, setRateForm] = useState({ baseCurrency: "INR", targetCurrency: "USD", rate: "", asOfDate: today });
  const [revalDate, setRevalDate] = useState(today);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, v] = await Promise.all([fetch("/api/accounting/currency/rates"), fetch("/api/accounting/currency/revaluations")]);
      const rd = await r.json(); const vd = await v.json();
      if (!r.ok) throw new Error(rd.error ?? "Failed to load rates");
      setRates(rd.rates); setRevals(vd.revaluations ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const addRate = async () => {
    setError(null);
    try {
      const res = await fetch("/api/accounting/currency/rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...rateForm, rate: Number(rateForm.rate), asOfDate: new Date(rateForm.asOfDate).toISOString() }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to add rate");
      setRateForm({ ...rateForm, rate: "" });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  };

  const delRate = async (id: string) => {
    if (!confirm("Delete this rate?")) return;
    await fetch(`/api/accounting/currency/rates/${id}`, { method: "DELETE" });
    await load();
  };

  const runPreview = async () => {
    setError(null); setPreview(null); setBusy(true);
    try {
      const res = await fetch(`/api/accounting/currency/revaluations?preview=${new Date(revalDate).toISOString()}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to preview");
      setPreview(d.preview);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  };

  const postReval = async () => {
    if (!confirm(`Post a currency revaluation as of ${revalDate}? This creates a FOREX journal for the net gain/loss.`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/accounting/currency/revaluations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asOfDate: new Date(revalDate).toISOString() }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to post");
      setPreview(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Currency</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>Maintain exchange rates and revalue foreign-currency balances into gain/loss journals.</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ padding: "8px 12px" }}><RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} /></button>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Rate book */}
      <motion.div className="surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Globe size={16} color="var(--brand-400)" /> Exchange Rates</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <input value={rateForm.baseCurrency} onChange={(e) => setRateForm({ ...rateForm, baseCurrency: e.target.value.toUpperCase() })} maxLength={3} placeholder="Base" style={{ ...inputStyle, width: 70 }} />
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <input value={rateForm.targetCurrency} onChange={(e) => setRateForm({ ...rateForm, targetCurrency: e.target.value.toUpperCase() })} maxLength={3} placeholder="Target" style={{ ...inputStyle, width: 70 }} />
          <input type="number" value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })} placeholder="Rate (base per target)" style={{ ...inputStyle, width: 170 }} />
          <input type="date" value={rateForm.asOfDate} onChange={(e) => setRateForm({ ...rateForm, asOfDate: e.target.value })} style={inputStyle} />
          <button onClick={addRate} className="btn-brand" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px" }}><Plus size={14} /> Add</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}><th style={th}>Pair</th><th style={{ ...th, textAlign: "right" }}>Rate</th><th style={th}>As of</th><th style={th}>Source</th><th style={th}></th></tr></thead>
            <tbody>
              {rates.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No rates yet.</td></tr>}
              {rates.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600, color: "var(--text-primary)" }}>{r.baseCurrency}/{r.targetCurrency}</td>
                  <td style={{ ...td, textAlign: "right" }}>{Number(r.rate)}</td>
                  <td style={td}>{new Date(r.asOfDate).toLocaleDateString("en-IN")}</td>
                  <td style={td}>{r.source ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}><button onClick={() => delRate(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Revaluation */}
      <motion.div className="surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Calculator size={16} color="var(--brand-400)" /> Revaluation</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>As of</span>
          <input type="date" value={revalDate} onChange={(e) => setRevalDate(e.target.value)} style={inputStyle} />
          <button onClick={runPreview} disabled={busy} className="btn-ghost" style={{ padding: "8px 14px" }}>Preview</button>
          {preview && preview.lines.length > 0 && <button onClick={postReval} disabled={busy} className="btn-brand" style={{ padding: "8px 14px" }}>Post Revaluation</button>}
        </div>
        {preview && (
          <div>
            {preview.lines.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No foreign-currency exposure to revalue on this date (need foreign journal entries + an on-file rate).</p>
            ) : (
              <>
                <div style={{ overflowX: "auto", marginBottom: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                      <th style={th}>Account</th><th style={th}>Ccy</th><th style={{ ...th, textAlign: "right" }}>Foreign</th><th style={{ ...th, textAlign: "right" }}>New Rate</th><th style={{ ...th, textAlign: "right" }}>Base Before</th><th style={{ ...th, textAlign: "right" }}>Base After</th><th style={{ ...th, textAlign: "right" }}>Gain/Loss</th>
                    </tr></thead>
                    <tbody>
                      {preview.lines.map((l, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ ...td, color: "var(--text-primary)" }}>{l.accountCode} — {l.accountName}</td>
                          <td style={td}>{l.currency}</td>
                          <td style={{ ...td, textAlign: "right" }}>{l.foreignBalance.toLocaleString()}</td>
                          <td style={{ ...td, textAlign: "right" }}>{l.newRate}</td>
                          <td style={{ ...td, textAlign: "right" }}>{formatCurrency(l.baseBefore)}</td>
                          <td style={{ ...td, textAlign: "right" }}>{formatCurrency(l.baseAfter)}</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 600, color: l.gainLoss >= 0 ? "#10b981" : "#ef4444" }}>{formatCurrency(l.gainLoss)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: preview.totalGainLoss >= 0 ? "#10b981" : "#ef4444" }}>Net {preview.totalGainLoss >= 0 ? "gain" : "loss"}: {formatCurrency(preview.totalGainLoss)}</p>
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* Past runs */}
      <motion.div className="surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Revaluation History</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}><th style={th}>As of</th><th style={th}>Base</th><th style={th}>Lines</th><th style={{ ...th, textAlign: "right" }}>Net Gain/Loss</th><th style={th}>Status</th></tr></thead>
            <tbody>
              {revals.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No revaluations posted yet.</td></tr>}
              {revals.map((rv) => (
                <tr key={rv.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, color: "var(--text-primary)" }}>{new Date(rv.asOfDate).toLocaleDateString("en-IN")}</td>
                  <td style={td}>{rv.baseCurrency}</td>
                  <td style={td}>{rv._count?.lines ?? 0}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: Number(rv.totalGainLoss) >= 0 ? "#10b981" : "#ef4444" }}>{formatCurrency(Number(rv.totalGainLoss))}</td>
                  <td style={td}><span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 6 }}>{rv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
