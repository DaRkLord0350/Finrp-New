"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2, BarChart3 } from "lucide-react";
import { useAccountOptions } from "@/hooks/useChartOfAccounts";
import { periodLabels, type BudgetGranularity } from "@/lib/accounting/budget-periods";
import { formatCurrency } from "@/lib/formatters/currency";

interface BudgetData {
  id: string;
  name: string;
  granularity: BudgetGranularity;
  status: string;
  fiscalYear: { name: string; startDate: string; endDate: string };
  lines: { accountId: string; periodIndex: number; amount: string }[];
}

export default function BudgetEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { options } = useAccountOptions(false);

  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [rows, setRows] = useState<string[]>([]); // accountIds in display order
  const [amounts, setAmounts] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [picker, setPicker] = useState("");

  const labels = useMemo(
    () => (budget ? periodLabels(budget.granularity, budget.fiscalYear.startDate) : []),
    [budget]
  );
  const nPeriods = labels.length;
  const accountLabel = useCallback((aid: string) => {
    const o = options.find((x) => x.id === aid);
    return o ? `${o.code} — ${o.name}` : aid;
  }, [options]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/budgets/${id}`);
      const data: BudgetData = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? "Failed to load");
      setBudget(data);
      const n = periodLabels(data.granularity, data.fiscalYear.startDate).length;
      const map: Record<string, number[]> = {};
      const order: string[] = [];
      for (const l of data.lines) {
        if (!map[l.accountId]) { map[l.accountId] = Array(n).fill(0); order.push(l.accountId); }
        if (l.periodIndex < n) map[l.accountId][l.periodIndex] = Number(l.amount);
      }
      setAmounts(map);
      setRows(order);
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addAccount = (aid: string) => {
    if (!aid || rows.includes(aid)) return;
    setRows((r) => [...r, aid]);
    setAmounts((a) => ({ ...a, [aid]: Array(nPeriods).fill(0) }));
    setPicker("");
  };
  const removeAccount = (aid: string) => {
    setRows((r) => r.filter((x) => x !== aid));
    setAmounts((a) => { const n = { ...a }; delete n[aid]; return n; });
  };
  const setCell = (aid: string, idx: number, val: number) => {
    setAmounts((a) => { const arr = [...(a[aid] ?? Array(nPeriods).fill(0))]; arr[idx] = val; return { ...a, [aid]: arr }; });
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const lines: { accountId: string; periodIndex: number; amount: number }[] = [];
      for (const aid of rows) {
        (amounts[aid] ?? []).forEach((amt, idx) => { if (Math.abs(amt) >= 0.005) lines.push({ accountId: aid, periodIndex: idx, amount: amt }); });
      }
      const res = await fetch(`/api/accounting/budgets/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setMsg({ type: "ok", text: "Budget saved." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: string) => {
    const res = await fetch(`/api/accounting/budgets/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok && budget) setBudget({ ...budget, status });
  };

  const rowTotal = (aid: string) => (amounts[aid] ?? []).reduce((s, v) => s + v, 0);
  const grandTotal = rows.reduce((s, aid) => s + rowTotal(aid), 0);
  const availableAccounts = options.filter((o) => !rows.includes(o.id));

  if (loading || !budget) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <div>
      <Link href="/accounting/budgets" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, marginBottom: 14, textDecoration: "none" }}><ArrowLeft size={14} /> Budgets</Link>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{budget.name}</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>{budget.fiscalYear.name} · {budget.granularity.toLowerCase()}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={budget.status} onChange={(e) => setStatus(e.target.value)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px", fontSize: 13, cursor: "pointer" }}>
            <option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option>
          </select>
          <Link href={`/accounting/budgets/${id}/variance`} className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13 }}><BarChart3 size={14} /> Variance</Link>
          <button onClick={save} disabled={saving} className="btn-brand" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", opacity: saving ? 0.6 : 1 }}><Save size={14} /> {saving ? "Saving…" : "Save"}</button>
        </div>
      </div>

      {msg && <div style={{ background: msg.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 8, padding: "10px 14px", color: msg.type === "ok" ? "#10b981" : "#ef4444", fontSize: 13, marginBottom: 16 }}>{msg.text}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <select value={picker} onChange={(e) => addAccount(e.target.value)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px", fontSize: 13, cursor: "pointer", minWidth: 240 }}>
          <option value="">+ Add account…</option>
          {availableAccounts.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}><Plus size={12} /> Pick accounts to budget</span>
      </div>

      <div className="surface" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", position: "sticky", left: 0, background: "var(--bg-card)", minWidth: 200 }}>Account</th>
                {labels.map((l) => <th key={l} style={{ padding: "10px 10px", textAlign: "right", minWidth: 90 }}>{l}</th>)}
                <th style={{ padding: "10px 14px", textAlign: "right", minWidth: 110 }}>Total</th>
                <th style={{ padding: "10px 8px" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={nPeriods + 3} style={{ padding: 36, textAlign: "center", color: "var(--text-muted)" }}>Add accounts to begin budgeting.</td></tr>}
              {rows.map((aid) => (
                <tr key={aid} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 14px", color: "var(--text-primary)", position: "sticky", left: 0, background: "var(--bg-surface)", fontWeight: 500 }}>{accountLabel(aid)}</td>
                  {Array.from({ length: nPeriods }).map((_, idx) => (
                    <td key={idx} style={{ padding: "4px 6px" }}>
                      <input
                        type="number"
                        value={amounts[aid]?.[idx] ?? 0}
                        onChange={(e) => setCell(aid, idx, parseFloat(e.target.value) || 0)}
                        style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", padding: "5px 7px", fontSize: 12, textAlign: "right", outline: "none" }}
                      />
                    </td>
                  ))}
                  <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(rowTotal(aid))}</td>
                  <td style={{ padding: "8px 8px", textAlign: "center" }}>
                    <button onClick={() => removeAccount(aid)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: "1px solid var(--border-strong)", background: "var(--bg-elevated)", fontWeight: 700 }}>
                  <td style={{ padding: "10px 14px", position: "sticky", left: 0, background: "var(--bg-elevated)", color: "var(--text-primary)" }}>Total</td>
                  <td colSpan={nPeriods} />
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text-primary)" }}>{formatCurrency(grandTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
