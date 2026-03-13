"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck, Plus, Clock, CheckCircle, AlertTriangle, Calendar, Tag, RefreshCw, Trash2, FileText, Download, Upload, Check,
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

const DOCUMENTS = [
  { label: "Company PAN Card", type: "PAN", uploaded: false },
  { label: "GST Certificate", type: "GST", uploaded: true },
  { label: "Certificate of Incorporation", type: "INCORPORATION", uploaded: false },
  { label: "Memorandum of Association", type: "MOA", uploaded: false },
];

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

      {/* Filters - Dropdown Style */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
          {filtered.length} task{filtered.length !== 1 ? "s" : ""} found
        </div>
      </div>

      {/* Main Layout: Tasks on Left, Documents on Right */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Tasks Section */}
        <div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ height: 120, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 20px", background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
              <FileText size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 15, color: "var(--text-secondary)", fontWeight: 500 }}>No tasks found</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Try adjusting your filters or add a new task.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map((task, i) => (
                <motion.div
                  key={task.id}
                  className="surface"
                  style={{ padding: 18 }}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ borderColor: "var(--border-strong)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${categoryColors[task.category] || "#52525b"}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ShieldCheck size={16} color={categoryColors[task.category] || "#52525b"} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{task.title}</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: `${categoryColors[task.category] || "#52525b"}18`, color: categoryColors[task.category] || "#52525b", border: `1px solid ${categoryColors[task.category] || "#52525b"}30` }}>
                            <Tag size={9} /> {task.category}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-muted)" }}>
                            <Calendar size={11} />
                            {format(new Date(task.dueDate), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)", cursor: "pointer" }}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="OVERDUE">OVERDUE</option>
                      </select>
                      <button onClick={() => handleDelete(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Company Documents Section */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, height: "fit-content" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={16} color="#3b82f6" />
            Company Documents
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DOCUMENTS.map((doc) => (
              <motion.div
                key={doc.type}
                style={{
                  padding: 12,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ borderColor: "var(--border-strong)" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{doc.label}</p>
                  <p style={{ fontSize: 11, color: doc.uploaded ? "#10b981" : "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    {doc.uploaded ? (
                      <>
                        <Check size={12} /> Uploaded
                      </>
                    ) : (
                      "Not Uploaded"
                    )}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {doc.uploaded ? (
                    <>
                      <button style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, border: "1px solid #3b82f6", background: "#3b82f618", color: "#3b82f6", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s" }}>
                        <Download size={12} /> View
                      </button>
                      <button style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, border: "1px solid #f59e0b", background: "#f59e0b18", color: "#f59e0b", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s" }}>
                        <Upload size={12} /> Replace
                      </button>
                    </>
                  ) : (
                    <button style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, border: "1px solid #6366f1", background: "#6366f118", color: "#6366f1", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s" }}>
                      <Upload size={12} /> Upload
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

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
