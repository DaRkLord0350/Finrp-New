"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ClipboardList, Plus, X, Filter } from "lucide-react";

interface FirmTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string;
  createdAt: string;
  customer: { id: string; name: string };
  assignedCa: { id: string; name: string | null; email: string };
}

interface Customer { id: string; name: string }
interface CAUser { id: string; name: string | null; email: string }

const statusColor: Record<string, string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  WAITING_CLIENT: "#f97316",
  REVIEW: "#8b5cf6",
  COMPLETED: "#10b981",
};

const priorityColor: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#3b82f6",
  HIGH: "#f59e0b",
  CRITICAL: "#ef4444",
};

export default function FirmTasksPage() {
  const [tasks, setTasks] = useState<FirmTask[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [caUsers, setCaUsers] = useState<CAUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    customerId: "",
    assignedCaId: "",
    dueDate: "",
    priority: "MEDIUM",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [taskRes, custRes] = await Promise.all([
        fetch("/api/firm/tasks"),
        fetch("/api/firm/customers?withCA=true"),
      ]);
      const taskData = await taskRes.json();
      const custData = await custRes.json();
      setTasks(taskData.tasks ?? []);
      setCustomers(custData.customers ?? []);
      setCaUsers(custData.caUsers ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter === "ALL" ? tasks : tasks.filter((t) => t.status === statusFilter);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/firm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ title: "", description: "", customerId: "", assignedCaId: "", dueDate: "", priority: "MEDIUM" });
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    await fetch(`/api/firm/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const byStatus = {
    ALL: tasks.length,
    PENDING: tasks.filter((t) => t.status === "PENDING").length,
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    WAITING_CLIENT: tasks.filter((t) => t.status === "WAITING_CLIENT").length,
    REVIEW: tasks.filter((t) => t.status === "REVIEW").length,
    COMPLETED: tasks.filter((t) => t.status === "COMPLETED").length,
  };

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">Tasks</h1>
          <p className="section-subtitle">{tasks.length} compliance task{tasks.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          className="btn-brand"
          onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={15} />
          New Task
        </button>
      </div>

      {/* Status Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {Object.entries(byStatus).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              padding: "6px 14px",
              borderRadius: 99,
              border: `1px solid ${statusFilter === status ? (statusColor[status] ?? "#6366f1") : "var(--border)"}`,
              background: statusFilter === status ? `${statusColor[status] ?? "#6366f1"}18` : "transparent",
              color: statusFilter === status ? (statusColor[status] ?? "#6366f1") : "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {status.replace("_", " ")} ({count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="section-card">
          <div className="empty-state">
            <div className="loading-spinner" />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading tasks...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <ClipboardList size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              {statusFilter !== "ALL" ? `No ${statusFilter.replace("_", " ")} tasks` : "No tasks yet"}
            </p>
            {statusFilter === "ALL" && (
              <button className="btn-brand" onClick={() => setShowModal(true)}>Create first task</button>
            )}
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Customer</th>
                <th>Assigned CA</th>
                <th>Due Date</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr key={task.id}>
                  <td>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{task.title}</p>
                    {task.description && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240, whiteSpace: "nowrap" }}>
                        {task.description}
                      </p>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{task.customer.name}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {task.assignedCa.name ?? task.assignedCa.email}
                  </td>
                  <td style={{ fontSize: 12, color: new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" ? "#ef4444" : "var(--text-muted)" }}>
                    {format(new Date(task.dueDate), "dd MMM yyyy")}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: `${priorityColor[task.priority]}18`,
                        color: priorityColor[task.priority],
                        borderColor: `${priorityColor[task.priority]}30`,
                      }}
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: `${statusColor[task.status]}18`,
                        color: statusColor[task.status],
                        borderColor: `${statusColor[task.status]}30`,
                      }}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        outline: "none",
                      }}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="WAITING_CLIENT">Waiting Client</option>
                      <option value="REVIEW">Review</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Task Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 520,
              boxShadow: "var(--shadow-lg)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Create Task</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. GST Return Filing — Q1"
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Task details..."
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Customer *</label>
                  <select
                    required
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Assign CA *</label>
                  <select
                    required
                    value={form.assignedCaId}
                    onChange={(e) => setForm({ ...form, assignedCaId: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
                  >
                    <option value="">Select CA...</option>
                    {caUsers.map((ca) => <option key={ca.id} value={ca.id}>{ca.name ?? ca.email}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Due Date *</label>
                  <input
                    required
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-brand" disabled={saving}>
                  {saving ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
