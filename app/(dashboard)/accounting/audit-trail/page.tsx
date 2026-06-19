"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface Row {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  description: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

const ctrl: React.CSSProperties = { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px", fontSize: 13, outline: "none" };
const ACTIONS = ["CREATE", "UPDATE", "DELETE", "POST", "REVERSE", "LOCK", "CLOSE", "SETTINGS_CHANGE", "EXPORT", "IMPORT"];

export default function AuditTrailPage() {
  const { isMobile } = useBreakpoint();
  const [rows, setRows] = useState<Row[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (entity) p.set("entity", entity);
      if (action) p.set("action", action);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      const res = await fetch(`/api/accounting/audit-trail?${p.toString()}`);
      const d = await res.json();
      if (res.ok) { setRows(d.rows); setTotal(d.total); setEntities(d.entities ?? []); }
    } finally { setLoading(false); }
  }, [page, entity, action, from, to]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  const actionColor = (a: string) => ({ CREATE: "#10b981", POST: "#10b981", UPDATE: "#818cf8", SETTINGS_CHANGE: "#818cf8", DELETE: "#ef4444", REVERSE: "#ef4444", LOCK: "#f59e0b", CLOSE: "#f59e0b" } as Record<string, string>)[a] ?? "var(--text-muted)";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Audit Trail</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>Every accounting change — who, when, and the before/after values.</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ padding: "8px 12px" }}><RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} /></button>
      </div>

      <div className="surface" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 16px", marginBottom: 16, alignItems: "center" }}>
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} style={{ ...ctrl, cursor: "pointer" }}>
          <option value="">All entities</option>
          {entities.map((en) => <option key={en} value={en}>{en.replace(/_/g, " ")}</option>)}
        </select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} style={{ ...ctrl, cursor: "pointer" }}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} style={ctrl} />
        <span style={{ color: "var(--text-muted)" }}>→</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} style={ctrl} />
      </div>

      <motion.div className="surface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>
              <th style={th}></th><th style={th}>When</th><th style={th}>Action</th><th style={th}>Entity</th><th style={th}>Description</th><th style={th}>User</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} style={{ padding: 36, textAlign: "center", color: "var(--text-muted)" }}>No audit entries.</td></tr>}
            {!loading && rows.map((r) => {
              const hasDiff = Boolean(r.oldValue || r.newValue);
              const open = expanded.has(r.id);
              return (
                <Fragment key={r.id}>
                  <tr style={{ borderTop: "1px solid var(--border)", cursor: hasDiff ? "pointer" : "default" }} onClick={() => hasDiff && toggle(r.id)}>
                    <td style={{ ...td, width: 28 }}>{hasDiff ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}</td>
                    <td style={td}>{new Date(r.createdAt).toLocaleString("en-IN")}</td>
                    <td style={td}><span style={{ fontSize: 11, fontWeight: 700, color: actionColor(r.action), background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: 6 }}>{r.action}</span></td>
                    <td style={{ ...td, color: "var(--text-primary)" }}>{r.entity.replace(/_/g, " ")}</td>
                    <td style={td}>{r.description}</td>
                    <td style={td}>{r.user?.name ?? r.user?.email ?? "System"}</td>
                  </tr>
                  {open && hasDiff && (
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      <td colSpan={6} style={{ padding: "10px 24px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                          <div><p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>BEFORE</p><pre style={preStyle}>{r.oldValue ? JSON.stringify(r.oldValue, null, 2) : "—"}</pre></div>
                          <div><p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>AFTER</p><pre style={preStyle}>{r.newValue ? JSON.stringify(r.newValue, null, 2) : "—"}</pre></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{total} entries · page {page}/{totalPages}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
          </div>
        </div>
      </motion.div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 16px", color: "var(--text-secondary)" };
const preStyle: React.CSSProperties = { fontSize: 11, color: "var(--text-secondary)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: 10, overflowX: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" };
