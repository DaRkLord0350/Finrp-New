"use client";

import { useState, useEffect, useCallback, use } from "react";
import { format } from "date-fns";
import { FileText, Plus, X, Save, Users, UserPlus, ChevronLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface TemplateTask {
  id?: string;
  title: string;
  description?: string;
  daysBeforeDue: number;
  sortOrder: number;
}

interface Customer { id: string; name: string; email: string | null }
interface AssignedCustomer { customer: Customer; assignedAt: string }

interface Template {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  isActive: boolean;
  tasks: TemplateTask[];
  assignments: AssignedCustomer[];
}

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", HALF_YEARLY: "Half-Yearly", YEARLY: "Yearly", CUSTOM: "Custom",
};

export default function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const [form, setForm] = useState({ name: "", description: "", frequency: "MONTHLY", isActive: true });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<{ tasksCreated: number; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/firm/templates/${id}`);
      const data = await res.json();
      if (data.template) {
        setTemplate(data.template);
        setForm({ name: data.template.name, description: data.template.description ?? "", frequency: data.template.frequency, isActive: data.template.isActive });
        setTasks(data.template.tasks);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showAssignModal && customers.length === 0) {
      fetch("/api/firm/customers").then((r) => r.json()).then((d) => setCustomers(d.customers ?? []));
    }
  }, [showAssignModal, customers.length]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/firm/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tasks: tasks.filter((t) => t.title.trim()) }),
      });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedCustomer) return;
    setAssigning(true);
    setAssignResult(null);
    try {
      const res = await fetch(`/api/firm/templates/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selectedCustomer }),
      });
      const data = await res.json();
      if (res.ok) {
        setAssignResult({ tasksCreated: data.tasksCreated, message: data.message });
        load();
      }
    } finally {
      setAssigning(false);
    }
  };

  const addTask = () => setTasks((p) => [...p, { title: "", daysBeforeDue: 7, sortOrder: p.length }]);
  const removeTask = (i: number) => setTasks((p) => p.filter((_, idx) => idx !== i));
  const updateTask = (i: number, field: keyof TemplateTask, value: string | number) =>
    setTasks((p) => p.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));

  if (loading) {
    return (
      <div className="page-container"><div className="section-card"><div className="empty-state"><div className="loading-spinner" /><p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading template...</p></div></div></div>
    );
  }

  if (!template) {
    return (
      <div className="page-container"><div className="section-card"><div className="empty-state"><FileText size={40} color="var(--text-muted)" /><p style={{ color: "var(--text-muted)" }}>Template not found</p><Link href="/firm/templates" className="btn-ghost">Back to templates</Link></div></div></div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <Link href="/firm/templates" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}>
          <ChevronLeft size={14} /> Templates
        </Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <h1 className="section-title" style={{ fontSize: 20, margin: 0 }}>{template.name}</h1>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => setShowAssignModal(true)} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <UserPlus size={14} /> Assign to Client
          </button>
          <button onClick={handleSave} className="btn-brand" disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Save size={14} />{saving ? "Saving..." : "Save Changes"}
          </button>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* Left — Edit */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="section-card">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Template Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Frequency</label>
                  <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", cursor: "pointer" }}>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <label htmlFor="isActive" style={{ fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>Template is active</label>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Sub-Tasks ({tasks.length})</h3>
              <button onClick={addTask} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--brand-400)" }}>
                <Plus size={13} /> Add task
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tasks.map((task, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px 32px", gap: 8, alignItems: "center", padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <input value={task.title} onChange={(e) => updateTask(i, "title", e.target.value)} placeholder={`Task ${i + 1}...`}
                    style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" value={task.daysBeforeDue} onChange={(e) => updateTask(i, "daysBeforeDue", parseInt(e.target.value) || 0)} min={0}
                      style={{ width: 48, padding: "4px 6px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--text-primary)", outline: "none", textAlign: "center" }} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>days before</span>
                  </div>
                  <button onClick={() => removeTask(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
                </div>
              ))}
              {tasks.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No tasks yet. Add at least one task.</p>}
            </div>
          </div>
        </div>

        {/* Right — Assigned Clients */}
        <div className="section-card" style={{ alignSelf: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Users size={15} color="#6366f1" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Assigned Clients ({template.assignments.length})</h3>
          </div>
          {template.assignments.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <Users size={28} color="var(--text-muted)" style={{ margin: "0 auto 8px" }} />
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No clients assigned yet</p>
              <button onClick={() => setShowAssignModal(true)} className="btn-brand" style={{ marginTop: 10, fontSize: 12 }}>Assign to client</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {template.assignments.map((a) => (
                <div key={a.customer.id} style={{ padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.customer.name}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.customer.email}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Assigned {format(new Date(a.assignedAt), "dd MMM yyyy")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAssignModal(false); setAssignResult(null); } }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Assign Template to Client</h2>
              <button onClick={() => { setShowAssignModal(false); setAssignResult(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
            </div>

            {assignResult ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <CheckCircle2 size={40} color="#10b981" style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Template Assigned!</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{assignResult.message}</p>
                <button onClick={() => { setShowAssignModal(false); setAssignResult(null); setSelectedCustomer(""); }} className="btn-brand" style={{ marginTop: 16 }}>Done</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Select Client</label>
                  <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", cursor: "pointer" }}>
                    <option value="">Choose a client...</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ padding: "12px 14px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8 }}>
                  <p style={{ fontSize: 12, color: "#818cf8" }}>
                    This will generate {template.tasks.length} task{template.tasks.length !== 1 ? "s" : ""} ×{" "}
                    {({ MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, YEARLY: 1, CUSTOM: 1 }[template.frequency] ?? 1)} occurrence{({ MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, YEARLY: 1, CUSTOM: 1 }[template.frequency] ?? 1) !== 1 ? "s" : ""} ={" "}
                    <strong>{template.tasks.length * (({ MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, YEARLY: 1, CUSTOM: 1 }[template.frequency] ?? 1))}</strong> total tasks
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowAssignModal(false)} className="btn-ghost">Cancel</button>
                  <button onClick={handleAssign} className="btn-brand" disabled={assigning || !selectedCustomer}>
                    {assigning ? "Generating tasks..." : "Assign & Generate Tasks"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
