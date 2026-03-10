"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck, Plus, Clock, CheckCircle, AlertTriangle, Calendar, Tag, RefreshCw, Trash2,
} from "lucide-react";
import { useState } from "react";
import { getTaskStatusColor } from "@/lib/utils";
import ComplianceTaskForm from "@/components/ComplianceTaskForm";
import type { CreateComplianceTaskInput } from "@/types";
import { useCompliance } from "@/hooks/useCompliance";
import { format } from "date-fns";

const categoryColors: Record<string, string> = {
  TAX: "#6366f1", REGULATORY: "#3b82f6", LICENSE: "#f59e0b",
  AUDIT: "#8b5cf6", REPORTING: "#10b981", OTHER: "#52525b",
};

const statusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock size={14} color="#f59e0b" />,
  IN_PROGRESS: <Clock size={14} color="#3b82f6" />,
  COMPLETED: <CheckCircle size={14} color="#10b981" />,
  OVERDUE: <AlertTriangle size={14} color="#ef4444" />,
};

const categories = ["All", "TAX", "REGULATORY", "LICENSE", "AUDIT", "REPORTING"];
const statuses = ["All", "PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE"];

export default function CompliancePage() {
  const { tasks, loading, error, refetch, createTask, updateTaskStatus, deleteTask } = useCompliance();
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);

  const filtered = tasks.filter((t) => {
    const matchCat = categoryFilter === "All" || t.category === categoryFilter;
    const matchStatus = statusFilter === "All" || t.status === statusFilter;
    return matchCat && matchStatus;
  });

  const handleCreateTask = async (data: CreateComplianceTaskInput) => {
    try {
      await createTask({
        title: data.title,
        description: data.description,
        category: data.category,
        dueDate: data.dueDate,
      });
      setShowForm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create task");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateTaskStatus(id, status);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this compliance task?")) return;
    try {
      await deleteTask(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const pending = tasks.filter((t) => t.status === "PENDING").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const overdue = tasks.filter((t) => t.status === "OVERDUE").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Compliance</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>Track regulatory obligations, deadlines, and compliance tasks.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={refetch} style={{ padding: "8px 12px" }}>
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button className="btn-brand" onClick={() => setShowForm(true)}>
            <Plus size={15} /> Add Task
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 20 }}>
          {error} — <button onClick={refetch} style={{ color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* Status Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Pending", count: pending, color: "#f59e0b", icon: <Clock size={16} color="#f59e0b" /> },
          { label: "In Progress", count: inProgress, color: "#3b82f6", icon: <Clock size={16} color="#3b82f6" /> },
          { label: "Completed", count: completed, color: "#10b981", icon: <CheckCircle size={16} color="#10b981" /> },
          { label: "Overdue", count: overdue, color: "#ef4444", icon: <AlertTriangle size={16} color="#ef4444" /> },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            style={{ padding: "16px 18px", background: "var(--bg-surface)", border: `1px solid ${item.count > 0 && item.label === "Overdue" ? "rgba(239,68,68,0.3)" : "var(--border)"}`, borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.icon}</div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{loading ? "—" : item.count}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{item.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", background: categoryFilter === cat ? `${categoryColors[cat] || "#6366f1"}20` : "transparent", borderColor: categoryFilter === cat ? `${categoryColors[cat] || "#6366f1"}60` : "var(--border)", color: categoryFilter === cat ? (categoryColors[cat] || "#818cf8") : "var(--text-secondary)", transition: "all 0.15s ease" }}>
              {cat}
            </button>
          ))}
        </div>
        <div style={{ height: 20, width: 1, background: "var(--border)" }} />
        <div style={{ display: "flex", gap: 6 }}>
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, border: "1px solid", cursor: "pointer", background: statusFilter === s ? "rgba(99,102,241,0.15)" : "transparent", borderColor: statusFilter === s ? "rgba(99,102,241,0.4)" : "var(--border)", color: statusFilter === s ? "#818cf8" : "var(--text-secondary)", transition: "all 0.15s ease" }}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Task Cards */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 130, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>No tasks found</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Try adjusting your filters or add a new task.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {filtered.map((task, i) => (
            <motion.div
              key={task.id}
              className="surface"
              style={{ padding: 20 }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ borderColor: "var(--border-strong)" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `${categoryColors[task.category] || "#52525b"}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={16} color={categoryColors[task.category] || "#52525b"} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{task.title}</h3>
                    <button onClick={() => handleDelete(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {task.description && (
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{task.description}</p>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: `${categoryColors[task.category] || "#52525b"}18`, color: categoryColors[task.category] || "#52525b", border: `1px solid ${categoryColors[task.category] || "#52525b"}30` }}>
                      <Tag size={9} /> {task.category}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: task.status === "OVERDUE" ? "#ef4444" : "var(--text-muted)" }}>
                      <Calendar size={11} />
                      Due {format(new Date(task.dueDate), "MMM d, yyyy")}
                    </span>
                    {/* Status toggle */}
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 600, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", cursor: "pointer" }}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="OVERDUE">OVERDUE</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showForm && (
        <ComplianceTaskForm
          onClose={() => setShowForm(false)}
          onSubmit={handleCreateTask}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
