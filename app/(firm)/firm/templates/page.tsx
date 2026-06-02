"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { FileText, Plus, X, Trash2, ToggleLeft, ToggleRight, Users, ChevronRight } from "lucide-react";
import Link from "next/link";

interface TemplateTask {
  id?: string;
  title: string;
  description?: string;
  daysBeforeDue: number;
  sortOrder: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  isActive: boolean;
  createdAt: string;
  tasks: TemplateTask[];
  _count: { assignments: number };
}

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-Yearly",
  YEARLY: "Yearly",
  CUSTOM: "Custom",
};

const FREQUENCY_COLORS: Record<string, string> = {
  MONTHLY: "#6366f1",
  QUARTERLY: "#0ea5e9",
  HALF_YEARLY: "#f59e0b",
  YEARLY: "#10b981",
  CUSTOM: "#8b5cf6",
};

const TEMPLATE_PRESETS = [
  { name: "GST Monthly Filing", frequency: "MONTHLY", tasks: [{ title: "Collect purchase invoices", daysBeforeDue: 10, sortOrder: 0 }, { title: "Reconcile GSTR-2A", daysBeforeDue: 7, sortOrder: 1 }, { title: "File GSTR-3B", daysBeforeDue: 1, sortOrder: 2 }] },
  { name: "TDS Quarterly Filing", frequency: "QUARTERLY", tasks: [{ title: "Compile TDS deduction data", daysBeforeDue: 15, sortOrder: 0 }, { title: "Prepare Form 26Q / 24Q", daysBeforeDue: 7, sortOrder: 1 }, { title: "File TDS return", daysBeforeDue: 2, sortOrder: 2 }] },
  { name: "ROC Annual Filing", frequency: "YEARLY", tasks: [{ title: "Prepare annual accounts", daysBeforeDue: 60, sortOrder: 0 }, { title: "Board resolution", daysBeforeDue: 45, sortOrder: 1 }, { title: "File Form AOC-4 / MGT-7", daysBeforeDue: 7, sortOrder: 2 }] },
  { name: "Income Tax Return", frequency: "YEARLY", tasks: [{ title: "Collect Form 16 / 26AS", daysBeforeDue: 45, sortOrder: 0 }, { title: "Prepare P&L and Balance Sheet", daysBeforeDue: 20, sortOrder: 1 }, { title: "File ITR", daysBeforeDue: 3, sortOrder: 2 }] },
];

const emptyTask = (): TemplateTask => ({ title: "", description: "", daysBeforeDue: 7, sortOrder: 0 });

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", frequency: "MONTHLY" });
  const [tasks, setTasks] = useState<TemplateTask[]>([emptyTask()]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/firm/templates");
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (preset: typeof TEMPLATE_PRESETS[0]) => {
    setForm({ name: preset.name, description: "", frequency: preset.frequency });
    setTasks(preset.tasks.map((t) => ({ ...t, description: "" })));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/firm/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tasks: tasks.filter((t) => t.title.trim()) }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ name: "", description: "", frequency: "MONTHLY" });
        setTasks([emptyTask()]);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/firm/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, isActive: !current } : t)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    await fetch(`/api/firm/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const addTask = () => setTasks((p) => [...p, { ...emptyTask(), sortOrder: p.length }]);
  const removeTask = (i: number) => setTasks((p) => p.filter((_, idx) => idx !== i));
  const updateTask = (i: number, field: keyof TemplateTask, value: string | number) =>
    setTasks((p) => p.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">Compliance Templates</h1>
          <p className="section-subtitle">{templates.length} template{templates.length !== 1 ? "s" : ""} · Auto-generate tasks for clients</p>
        </div>
        <button className="btn-brand" onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> New Template
        </button>
      </div>

      {loading ? (
        <div className="section-card"><div className="empty-state"><div className="loading-spinner" /><p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading templates...</p></div></div>
      ) : templates.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <FileText size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No templates yet</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 320, textAlign: "center" }}>
              Create compliance templates to auto-generate recurring tasks for your clients.
            </p>
            <button className="btn-brand" onClick={() => setShowModal(true)}>Create first template</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {templates.map((t) => {
            const color = FREQUENCY_COLORS[t.frequency] ?? "#6366f1";
            return (
              <div key={t.id} className="section-card" style={{ position: "relative", opacity: t.isActive ? 1 : 0.6 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={16} color={color} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{t.name}</p>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: `${color}18`, color, border: `1px solid ${color}30` }}>
                        {FREQUENCY_LABELS[t.frequency]}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => toggleActive(t.id, t.isActive)} style={{ background: "none", border: "none", cursor: "pointer", color: t.isActive ? "#10b981" : "var(--text-muted)" }} title={t.isActive ? "Deactivate" : "Activate"}>
                      {t.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <button onClick={() => handleDelete(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }} title="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {t.description && (
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>{t.description}</p>
                )}

                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                  <span>{t.tasks.length} task{t.tasks.length !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Users size={11} /> {t._count.assignments} client{t._count.assignments !== 1 ? "s" : ""}
                  </span>
                  <span>·</span>
                  <span>{format(new Date(t.createdAt), "dd MMM yyyy")}</span>
                </div>

                {t.tasks.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                    {t.tasks.slice(0, 3).map((task, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{task.title}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>-{task.daysBeforeDue}d</span>
                      </div>
                    ))}
                    {t.tasks.length > 3 && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>+{t.tasks.length - 3} more tasks</p>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <Link
                    href={`/firm/templates/${t.id}`}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", textDecoration: "none", background: "var(--bg-elevated)" }}
                  >
                    Edit <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 640, boxShadow: "var(--shadow-lg)", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>New Compliance Template</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>

            {/* Presets */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Quick Presets</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {TEMPLATE_PRESETS.map((p) => (
                  <button key={p.name} onClick={() => applyPreset(p)} style={{ padding: "5px 10px", borderRadius: 99, border: "1px solid var(--border)", background: "var(--bg-elevated)", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer" }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Template Name *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. GST Monthly Filing"
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Frequency *</label>
                  <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", cursor: "pointer" }}>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes about this template..." rows={2}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", resize: "vertical" }} />
              </div>

              {/* Task List */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Sub-Tasks</label>
                  <button type="button" onClick={addTask} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--brand-400)" }}>
                    <Plus size={13} /> Add task
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tasks.map((task, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 32px", gap: 8, alignItems: "center", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <input value={task.title} onChange={(e) => updateTask(i, "title", e.target.value)} placeholder={`Task ${i + 1} title...`}
                        style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)" }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="number" value={task.daysBeforeDue} onChange={(e) => updateTask(i, "daysBeforeDue", parseInt(e.target.value) || 0)} min={0}
                          style={{ width: 50, padding: "4px 6px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--text-primary)", outline: "none", textAlign: "center" }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>days before</span>
                      </div>
                      <button type="button" onClick={() => removeTask(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-brand" disabled={saving}>{saving ? "Creating..." : "Create Template"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
