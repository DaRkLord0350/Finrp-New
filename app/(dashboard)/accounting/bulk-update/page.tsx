"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Replace, RefreshCw, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useAccountOptions } from "@/hooks/useChartOfAccounts";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const SCOPES: { key: string; label: string }[] = [
  { key: "invoices", label: "Invoices" },
  { key: "invoice_items", label: "Invoice line items" },
  { key: "payments", label: "Payments" },
  { key: "expenses", label: "Expenses" },
  { key: "purchases", label: "Bills / Purchase Orders" },
  { key: "purchase_items", label: "Bill line items" },
  { key: "vendor_credits", label: "Vendor credits / credit notes" },
  { key: "vendors", label: "Vendors (A/P account)" },
  { key: "journal_lines", label: "Journal lines" },
];

interface Job {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  scopes: string[];
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  totalRecords: number;
  processedRecords: number;
  perEntityCounts: Record<string, number> | null;
  error: string | null;
  createdAt: string;
}

const ctrl: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "9px 12px", fontSize: 14, outline: "none" };

export default function BulkUpdatePage() {
  const { isMobile } = useBreakpoint();
  const { options } = useAccountOptions(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scopes, setScopes] = useState<string[]>(SCOPES.map((s) => s.key));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/accounting/bulk-account-update");
    const d = await res.json();
    if (res.ok) setJobs(d.jobs);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll while any job is in flight.
  useEffect(() => {
    const active = jobs.some((j) => j.status === "QUEUED" || j.status === "RUNNING");
    if (active && !pollRef.current) {
      pollRef.current = setInterval(load, 2000);
    } else if (!active && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current && !active) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [jobs, load]);

  const accountLabel = (id: string) => { const o = options.find((x) => x.id === id); return o ? `${o.code} — ${o.name}` : id; };
  const toggle = (key: string) => setScopes((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));

  const run = async () => {
    setError(null);
    if (!from || !to) { setError("Pick both accounts."); return; }
    if (scopes.length === 0) { setError("Select at least one scope."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/bulk-account-update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromAccountId: from, toAccountId: to, scopes }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to queue");
      if (d.queued === false) setError("Job created but the background worker queue is unavailable — start the worker process to run it.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const statusChip = (s: Job["status"]) => {
    const map = { QUEUED: ["#f59e0b", "rgba(245,158,11,0.1)"], RUNNING: ["#818cf8", "rgba(99,102,241,0.1)"], COMPLETED: ["#10b981", "rgba(16,185,129,0.1)"], FAILED: ["#ef4444", "rgba(239,68,68,0.1)"] } as const;
    const [c, bg] = map[s];
    return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: bg, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>{s === "RUNNING" && <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />}{s}</span>;
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Bulk Account Update</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>Replace one account with another across invoices, bills, payments, expenses, vendor credits and journal lines. Runs in the background.</p>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <motion.div className="surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 22, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Replace size={16} color="var(--brand-400)" /> Replace Account</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <select value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...ctrl, cursor: "pointer", minWidth: 220 }}>
            <option value="">From account…</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
          </select>
          <ArrowRight size={18} color="var(--text-muted)" />
          <select value={to} onChange={(e) => setTo(e.target.value)} style={{ ...ctrl, cursor: "pointer", minWidth: 220 }}>
            <option value="">To account…</option>
            {options.filter((o) => o.id !== from).map((o) => <option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
          </select>
        </div>

        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Apply to</p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 8, marginBottom: 18 }}>
          {SCOPES.map((s) => (
            <label key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", padding: "6px 0" }}>
              <input type="checkbox" checked={scopes.includes(s.key)} onChange={() => toggle(s.key)} />
              {s.label}
            </label>
          ))}
        </div>

        <button onClick={run} disabled={busy} className="btn-brand" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", opacity: busy ? 0.6 : 1 }}>
          <Replace size={15} /> {busy ? "Queuing…" : "Run Bulk Update"}
        </button>
      </motion.div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 className="section-title" style={{ fontSize: 14, color: "var(--text-secondary)" }}>Jobs</h3>
        <button onClick={load} className="btn-ghost" style={{ padding: "6px 10px" }}><RefreshCw size={14} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {jobs.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No bulk update jobs yet.</p>}
        {jobs.map((j) => {
          const pct = j.totalRecords > 0 ? Math.round((j.processedRecords / j.totalRecords) * 100) : j.status === "COMPLETED" ? 100 : 0;
          return (
            <div key={j.id} className="surface" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" }}>
                  {j.status === "COMPLETED" ? <CheckCircle2 size={15} color="#10b981" /> : j.status === "FAILED" ? <AlertTriangle size={15} color="#ef4444" /> : <Replace size={15} color="var(--text-muted)" />}
                  <span style={{ fontWeight: 600 }}>{accountLabel(j.fromAccountId)}</span>
                  <ArrowRight size={13} color="var(--text-muted)" />
                  <span style={{ fontWeight: 600 }}>{accountLabel(j.toAccountId)}</span>
                </div>
                {statusChip(j.status)}
              </div>
              <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: j.status === "FAILED" ? "#ef4444" : "var(--brand-500, #6366f1)", transition: "width 0.4s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", flexWrap: "wrap", gap: 8 }}>
                <span>{j.processedRecords} / {j.totalRecords} records · {pct}%</span>
                <span>{j.scopes.length} scope(s){j.perEntityCounts ? ` · ${Object.entries(j.perEntityCounts).map(([k, v]) => `${k}:${v}`).join(", ")}` : ""}</span>
              </div>
              {j.error && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>{j.error}</p>}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
