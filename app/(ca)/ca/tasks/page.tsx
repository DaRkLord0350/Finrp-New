"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ClipboardList, CheckCircle2 } from "lucide-react";

interface FirmTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string;
  notes: string | null;
  customer: { id: string; name: string };
}

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

export default function CATasksPage() {
  const [tasks, setTasks] = useState<FirmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [updateNote, setUpdateNote] = useState<{ id: string; status: string } | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/ca/firm-tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter === "ALL" ? tasks : tasks.filter((t) => t.status === statusFilter);

  const handleStatusUpdate = async (id: string, status: string) => {
    await fetch(`/api/firm/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    setUpdateNote(null);
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
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">My Tasks</h1>
        <p className="section-subtitle">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} assigned to you
        </p>
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
              {statusFilter !== "ALL" ? `No ${statusFilter.replace("_", " ")} tasks` : "No tasks assigned to you"}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((task) => (
            <div
              key={task.id}
              className="section-card"
              style={{ padding: "16px 20px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{task.title}</p>
                    <span
                      className="badge"
                      style={{
                        background: `${priorityColor[task.priority]}18`,
                        color: priorityColor[task.priority],
                        borderColor: `${priorityColor[task.priority]}30`,
                        flexShrink: 0,
                      }}
                    >
                      {task.priority}
                    </span>
                  </div>
                  {task.description && (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{task.description}</p>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Customer: <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{task.customer.name}</span>
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: new Date(task.dueDate) < new Date() && task.status !== "COMPLETED" ? "#ef4444" : "var(--text-muted)",
                      }}
                    >
                      Due: {format(new Date(task.dueDate), "dd MMM yyyy")}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
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
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                    style={{
                      fontSize: 12,
                      padding: "5px 10px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value="PENDING">Mark Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING_CLIENT">Waiting Client</option>
                    <option value="REVIEW">Ready for Review</option>
                    <option value="COMPLETED">Mark Complete</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
