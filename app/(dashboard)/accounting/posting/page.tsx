"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Upload, RefreshCw, Boxes, CheckCircle2 } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { formatCurrency } from "@/lib/formatters/currency";

type Source = "INVOICE" | "PAYMENT" | "EXPENSE" | "PURCHASE";
interface Docs {
  invoices: { id: string; invoiceNumber: string; total: string; issueDate: string }[];
  payments: { id: string; amount: string; paidAt: string; reference: string | null }[];
  expenses: { id: string; description: string; amount: string; expenseDate: string }[];
  purchases: { id: string; purchaseNumber: string; totalAmount: string; purchaseDate: string }[];
}

export default function PostingPage() {
  const { isMobile } = useBreakpoint();
  const [docs, setDocs] = useState<Docs | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounting/post");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to load");
      setDocs(d);
    } catch (err) { setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = async (source: Source, sourceId: string) => {
    setBusy(`${source}:${sourceId}`); setMsg(null);
    try {
      const res = await fetch("/api/accounting/post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, sourceId }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to post");
      setMsg({ type: "ok", text: "Posted to ledger." });
      await load();
    } catch (err) { setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setBusy(null); }
  };

  const postInventory = async () => {
    setBusy("INVENTORY"); setMsg(null);
    try {
      const res = await fetch("/api/accounting/post", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "INVENTORY", sourceId: new Date().toISOString().slice(0, 10) }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to post");
      setMsg({ type: "ok", text: "Inventory valuation posted." });
    } catch (err) { setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed" }); }
    finally { setBusy(null); }
  };

  const section = (title: string, source: Source, rows: { id: string; label: string; sub: string; amount: number }[]) => (
    <motion.div className="surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 18, marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>{title} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({rows.length})</span></h3>
      {rows.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={14} color="#10b981" /> All caught up — nothing unposted.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.sub}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{formatCurrency(r.amount)}</span>
                <button onClick={() => post(source, r.id)} disabled={busy === `${source}:${r.id}`} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Upload size={13} /> {busy === `${source}:${r.id}` ? "Posting…" : "Post"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Post to Ledger</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>Create double-entry journals from source documents. Posting is idempotent — a document can&apos;t be posted twice.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={postInventory} disabled={busy === "INVENTORY"} className="btn-ghost" style={{ padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}><Boxes size={15} /> {busy === "INVENTORY" ? "Posting…" : "Post Inventory Valuation"}</button>
          <button onClick={load} className="btn-ghost" style={{ padding: "8px 12px" }}><RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} /></button>
        </div>
      </div>

      {msg && <div style={{ background: msg.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 8, padding: "10px 14px", color: msg.type === "ok" ? "#10b981" : "#ef4444", fontSize: 13, marginBottom: 16 }}>{msg.text}</div>}

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
      {docs && (
        <>
          {section("Invoices", "INVOICE", docs.invoices.map((i) => ({ id: i.id, label: `Invoice ${i.invoiceNumber}`, sub: new Date(i.issueDate).toLocaleDateString("en-IN"), amount: Number(i.total) })))}
          {section("Payments", "PAYMENT", docs.payments.map((p) => ({ id: p.id, label: `Payment ${p.reference ?? p.id.slice(0, 8)}`, sub: new Date(p.paidAt).toLocaleDateString("en-IN"), amount: Number(p.amount) })))}
          {section("Expenses", "EXPENSE", docs.expenses.map((e) => ({ id: e.id, label: e.description, sub: new Date(e.expenseDate).toLocaleDateString("en-IN"), amount: Number(e.amount) })))}
          {section("Bills / Purchase Orders", "PURCHASE", docs.purchases.map((p) => ({ id: p.id, label: `Bill ${p.purchaseNumber}`, sub: new Date(p.purchaseDate).toLocaleDateString("en-IN"), amount: Number(p.totalAmount) })))}
        </>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
