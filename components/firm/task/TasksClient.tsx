"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Plus, Search, ArrowRight, X } from "lucide-react";

export interface TaskRow {
  id: string;
  title: string;
  customerId: string;
  customerName: string;
  caId: string;
  caName: string;
  priority: string;
  status: string;
  dueDate: string;
  createdAt: string;
}

export interface TaskOption {
  id: string;
  name: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  WAITING_CLIENT: "Waiting For Client",
  REVIEW: "In Review",
  COMPLETED: "Completed",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  WAITING_CLIENT: "#f97316",
  REVIEW: "#8b5cf6",
  COMPLETED: "#10b981",
};
const PRIORITY_LABEL: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };
const PRIORITY_COLOR: Record<string, string> = { LOW: "#94a3b8", MEDIUM: "#0ea5e9", HIGH: "#f59e0b", CRITICAL: "#ef4444" };

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function isOverdue(t: TaskRow) {
  return t.status !== "COMPLETED" && new Date(t.dueDate) < new Date();
}

export function TasksClient({ rows, customers, cas }: { rows: TaskRow[]; customers: TaskOption[]; cas: TaskOption[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [fCustomer, setFCustomer] = useState("");
  const [fCa, setFCa] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fDue, setFDue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCaId, setBulkCaId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 86400000);
    const monthEnd = new Date(now.getTime() + 30 * 86400000);
    return rows.filter((t) => {
      if (fCustomer && t.customerId !== fCustomer) return false;
      if (fCa && t.caId !== fCa) return false;
      if (fPriority && t.priority !== fPriority) return false;
      if (fStatus === "OVERDUE") {
        if (!isOverdue(t)) return false;
      } else if (fStatus && t.status !== fStatus) return false;
      if (fDue) {
        const d = new Date(t.dueDate);
        if (fDue === "OVERDUE" && !isOverdue(t)) return false;
        if (fDue === "WEEK" && !(d >= now && d <= weekEnd)) return false;
        if (fDue === "MONTH" && !(d >= now && d <= monthEnd)) return false;
      }
      if (q && !`${t.title} ${t.customerName} ${t.caName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, fCustomer, fCa, fPriority, fStatus, fDue]);

  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((p) => (p.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id))));
  }

  async function bulkAssign() {
    if (!bulkCaId) return toast.error("Select a CA");
    if (selected.size === 0) return toast.error("Select at least one task");
    setBusy(true);
    try {
      const res = await fetch("/api/firm/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: [...selected], assignedCaId: bulkCaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`${data.moved ?? 0} task(s) reassigned`);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const overdueCount = rows.filter(isOverdue).length;
  const openCount = rows.filter((t) => t.status !== "COMPLETED").length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 className="section-title">Tasks</h1>
          <p className="section-subtitle">{rows.length} total · {openCount} open · {overdueCount} overdue</p>
        </div>
        <button onClick={() => setCreateOpen(true)} style={primaryBtn}><Plus size={15} /> Create Task</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" style={{ width: "100%", padding: "9px 12px 9px 36px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }} />
        </div>
        <select value={fCustomer} onChange={(e) => setFCustomer(e.target.value)} style={selectStyle}>
          <option value="">All customers</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={fCa} onChange={(e) => setFCa(e.target.value)} style={selectStyle}>
          <option value="">All CAs</option>
          {cas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={fPriority} onChange={(e) => setFPriority(e.target.value)} style={selectStyle}>
          <option value="">All priorities</option>
          {Object.keys(PRIORITY_LABEL).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={selectStyle}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          <option value="OVERDUE">Overdue</option>
        </select>
        <select value={fDue} onChange={(e) => setFDue(e.target.value)} style={selectStyle}>
          <option value="">Any due date</option>
          <option value="OVERDUE">Overdue</option>
          <option value="WEEK">Due this week</option>
          <option value="MONTH">Due this month</option>
        </select>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>{selected.size} selected</span>
          <ArrowRight size={14} color="var(--text-muted)" />
          <select value={bulkCaId} onChange={(e) => setBulkCaId(e.target.value)} style={selectStyle}>
            <option value="">Reassign to CA…</option>
            {cas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={bulkAssign} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>Assign</button>
          <button onClick={() => setSelected(new Set())} style={secondaryBtn}>Clear</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <ClipboardList size={46} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{rows.length === 0 ? "No tasks yet" : "No tasks match your filters"}</p>
            {rows.length === 0 && <button onClick={() => setCreateOpen(true)} style={primaryBtn}>Create your first task</button>}
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table" style={{ minWidth: 920 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                <th>Task</th>
                <th>Customer</th>
                <th>Assigned CA</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const overdue = isOverdue(t);
                return (
                  <tr key={t.id} style={{ background: selected.has(t.id) ? "rgba(99,102,241,0.06)" : undefined }}>
                    <td><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} /></td>
                    <td>
                      <Link href={`/firm/tasks/${t.id}`} style={{ fontWeight: 600, color: "var(--brand-400)", textDecoration: "none" }}>{t.title}</Link>
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{t.customerName}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{t.caName}</td>
                    <td>
                      <span className="badge" style={{ background: `${PRIORITY_COLOR[t.priority]}18`, color: PRIORITY_COLOR[t.priority], borderColor: `${PRIORITY_COLOR[t.priority]}30` }}>
                        {PRIORITY_LABEL[t.priority] ?? t.priority}
                      </span>
                    </td>
                    <td style={{ fontSize: 12.5, color: overdue ? "#ef4444" : "var(--text-muted)", fontWeight: overdue ? 600 : 400 }}>
                      {fmt(t.dueDate)}{overdue && " · Overdue"}
                    </td>
                    <td>
                      <span className="badge" style={{ background: `${STATUS_COLOR[t.status]}18`, color: STATUS_COLOR[t.status], borderColor: `${STATUS_COLOR[t.status]}30` }}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && <CreateTaskModal customers={customers} cas={cas} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); router.refresh(); }} />}
    </div>
  );
}

function CreateTaskModal({
  customers,
  cas,
  onClose,
  onSaved,
}: {
  customers: TaskOption[];
  cas: TaskOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", customerId: "", assignedCaId: "", dueDate: "", priority: "MEDIUM" });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!form.title.trim() || !form.customerId || !form.assignedCaId || !form.dueDate) {
      toast.error("Title, customer, CA and due date are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/firm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
      toast.success("Task created");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create task");
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="section-card" style={{ width: "100%", maxWidth: 500 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Create Task</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Title" required><input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. File GSTR-3B for June" style={inp} /></Field>
          <Field label="Description"><textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional details…" rows={3} style={{ ...inp, resize: "vertical" }} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Customer" required>
              <select value={form.customerId} onChange={(e) => set("customerId", e.target.value)} style={inp}>
                <option value="">Select…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Assign to CA" required>
              <select value={form.assignedCaId} onChange={(e) => set("assignedCaId", e.target.value)} style={inp}>
                <option value="">Select…</option>
                {cas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Due Date" required><input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} style={inp} /></Field>
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)} style={inp}>
                {Object.keys(PRIORITY_LABEL).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
          <button onClick={onClose} style={{ ...secondaryBtn, flex: 1, justifyContent: "center" }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ ...primaryBtn, flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }}>{saving ? "Creating…" : "Create Task"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{label}{required && <span style={{ color: "#ef4444" }}> *</span>}</span>
      {children}
    </label>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 14,
};

const selectStyle: React.CSSProperties = {
  padding: "9px 12px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 13,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 16px",
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 16px",
  background: "var(--bg-surface)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
