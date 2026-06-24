"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, isPast, isToday } from "date-fns";
import { CalendarDays, Clock, AlertTriangle, Plus, Check, Loader2, ShieldCheck } from "lucide-react";

export interface CustomerOption {
  id: string;
  name: string;
}
export interface EntryDTO {
  id: string;
  customerId: string;
  customerName: string;
  type: string;
  title: string;
  period: string | null;
  dueDate: string;
  status: string;
  notes: string | null;
}

const TYPES = ["GST", "TDS", "ROC", "ITR", "PF", "ESI"];
const TYPE_COLOR: Record<string, string> = { GST: "#6366f1", TDS: "#0ea5e9", ROC: "#f59e0b", ITR: "#10b981", PF: "#8b5cf6", ESI: "#ec4899" };
const STATUS_COLOR: Record<string, string> = { UPCOMING: "#0ea5e9", DUE: "#f59e0b", OVERDUE: "#ef4444", COMPLETED: "#10b981" };

type View = "UPCOMING" | "OVERDUE" | "CALENDAR";

function effectiveStatus(e: EntryDTO): string {
  if (e.status === "COMPLETED") return "COMPLETED";
  const d = new Date(e.dueDate);
  if (isPast(d) && !isToday(d)) return "OVERDUE";
  if (isToday(d)) return "DUE";
  return "UPCOMING";
}

export default function ComplianceCenter({ entries, customers }: { entries: EntryDTO[]; customers: CustomerOption[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>("UPCOMING");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const withStatus = useMemo(() => entries.map((e) => ({ ...e, eff: effectiveStatus(e) })), [entries]);

  const filtered = useMemo(() => {
    let list = withStatus;
    if (typeFilter !== "ALL") list = list.filter((e) => e.type === typeFilter);
    if (view === "UPCOMING") list = list.filter((e) => e.eff === "UPCOMING" || e.eff === "DUE");
    else if (view === "OVERDUE") list = list.filter((e) => e.eff === "OVERDUE");
    return list;
  }, [withStatus, typeFilter, view]);

  const counts = {
    UPCOMING: withStatus.filter((e) => e.eff === "UPCOMING" || e.eff === "DUE").length,
    OVERDUE: withStatus.filter((e) => e.eff === "OVERDUE").length,
    CALENDAR: withStatus.length,
  };

  const markComplete = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/ca/compliance-calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  };

  // Group by "MMM yyyy" for calendar view.
  const calendarGroups = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const key = format(new Date(e.dueDate), "MMMM yyyy");
      m.set(key, [...(m.get(key) ?? []), e]);
    }
    return [...m.entries()];
  }, [filtered]);

  const views: { key: View; label: string; icon: typeof Clock }[] = [
    { key: "UPCOMING", label: "Upcoming", icon: Clock },
    { key: "OVERDUE", label: "Overdue", icon: AlertTriangle },
    { key: "CALENDAR", label: "Calendar", icon: CalendarDays },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {views.map((v) => {
            const Icon = v.icon;
            const active = view === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, border: `1px solid ${active ? "#6366f1" : "var(--border)"}`, background: active ? "rgba(99,102,241,0.12)" : "transparent", color: active ? "#818cf8" : "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                <Icon size={13} /> {v.label} ({counts[v.key]})
              </button>
            );
          })}
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="cc-select">
          <option value="ALL">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setShowForm((s) => !s)} className="cc-btn" style={{ marginLeft: "auto" }}>
          <Plus size={14} /> Add Deadline
        </button>
      </div>

      {showForm && <AddForm customers={customers} onDone={() => { setShowForm(false); router.refresh(); }} />}

      {filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <ShieldCheck size={44} color="var(--text-muted)" />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Nothing here</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {view === "OVERDUE" ? "No overdue filings — great work." : "Add a deadline to start tracking compliance."}
            </p>
          </div>
        </div>
      ) : view === "CALENDAR" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {calendarGroups.map(([month, list]) => (
            <div key={month}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>{month}</h2>
              <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
                <Table list={list} busy={busy} onComplete={markComplete} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <Table list={filtered} busy={busy} onComplete={markComplete} />
        </div>
      )}

      <style>{`
        .cc-select { padding: 7px 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; color: var(--text-secondary); font-size: 12.5px; outline: none; cursor: pointer; }
        .cc-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: none; border-radius: 8px; background: linear-gradient(135deg,#6366f1,#0ea5e9); color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .cc-input { width: 100%; padding: 8px 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 12.5px; outline: none; }
      `}</style>
    </>
  );
}

function Table({ list, busy, onComplete }: { list: (EntryDTO & { eff: string })[]; busy: string | null; onComplete: (id: string) => void }) {
  return (
    <table className="data-table">
      <thead>
        <tr><th>Type</th><th>Filing</th><th>Client</th><th>Period</th><th>Due</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        {list.map((e) => (
          <Fragment key={e.id}>
            <tr>
              <td><span className="badge" style={{ background: `${TYPE_COLOR[e.type]}1a`, color: TYPE_COLOR[e.type], borderColor: `${TYPE_COLOR[e.type]}30` }}>{e.type}</span></td>
              <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{e.title}</td>
              <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{e.customerName}</td>
              <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{e.period ?? "—"}</td>
              <td style={{ fontSize: 12, color: e.eff === "OVERDUE" ? "#ef4444" : "var(--text-secondary)" }}>{format(new Date(e.dueDate), "dd MMM yyyy")}</td>
              <td><span className="badge" style={{ background: `${STATUS_COLOR[e.eff]}1a`, color: STATUS_COLOR[e.eff], borderColor: `${STATUS_COLOR[e.eff]}30` }}>{e.eff}</span></td>
              <td style={{ textAlign: "right" }}>
                {e.eff !== "COMPLETED" && (
                  busy === e.id ? <Loader2 size={15} className="animate-spin" color="var(--text-muted)" /> : (
                    <button title="Mark complete" onClick={() => onComplete(e.id)} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #10b98130", background: "#10b98112", color: "#10b981", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={14} />
                    </button>
                  )
                )}
              </td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

function AddForm({ customers, onDone }: { customers: CustomerOption[]; onDone: () => void }) {
  const [form, setForm] = useState({ customerId: customers[0]?.id ?? "", type: "GST", title: "", period: "", dueDate: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ca/compliance-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "Failed to add");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section-card" style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Add Compliance Deadline</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="cc-input" style={{ cursor: "pointer" }}>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="cc-input" style={{ cursor: "pointer" }}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="cc-input" placeholder="e.g. GSTR-3B" />
        <input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="cc-input" placeholder="Period (e.g. Jun 2026)" />
        <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="cc-input" />
      </div>
      {error && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 10 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={submit} disabled={saving || !form.title || !form.dueDate} className="cc-btn" style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
        </button>
        <button onClick={onDone} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}
