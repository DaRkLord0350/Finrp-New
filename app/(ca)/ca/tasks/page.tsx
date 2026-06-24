"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { format, isToday, isThisWeek, isPast } from "date-fns";
import { ClipboardList, ChevronDown } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string;
  notes: string | null;
  customer: { id: string; name: string };
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  WAITING_CLIENT: "#f97316",
  REVIEW: "#8b5cf6",
  COMPLETED: "#10b981",
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#3b82f6",
  HIGH: "#f59e0b",
  CRITICAL: "#ef4444",
};
const STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "WAITING_CLIENT", "REVIEW", "COMPLETED"];

type GroupBy = "STATUS" | "CUSTOMER" | "DUE";

export default function CATasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("STATUS");

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/ca/firm-tasks")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load tasks"))))
      .then((d) => setTasks(d.tasks ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Initial fetch — relies on the `loading`/`error` initial state so we
  // never call setState synchronously inside the effect body.
  useEffect(() => {
    let active = true;
    fetch("/api/ca/firm-tasks")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load tasks"))))
      .then((d) => { if (active) setTasks(d.tasks ?? []); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const prev = tasks;
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, status } : x)));
    const res = await fetch(`/api/firm/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) setTasks(prev); // rollback
  };

  const groups = useMemo(() => {
    const g = new Map<string, Task[]>();
    const push = (key: string, t: Task) => g.set(key, [...(g.get(key) ?? []), t]);

    if (groupBy === "STATUS") {
      for (const s of STATUS_OPTIONS) g.set(s.replace("_", " "), []);
      tasks.forEach((t) => push(t.status.replace("_", " "), t));
    } else if (groupBy === "CUSTOMER") {
      tasks.forEach((t) => push(t.customer.name, t));
    } else {
      g.set("Overdue", []);
      g.set("Today", []);
      g.set("This Week", []);
      g.set("Later", []);
      tasks.forEach((t) => {
        const d = new Date(t.dueDate);
        if (t.status !== "COMPLETED" && isPast(d) && !isToday(d)) push("Overdue", t);
        else if (isToday(d)) push("Today", t);
        else if (isThisWeek(d)) push("This Week", t);
        else push("Later", t);
      });
    }
    return [...g.entries()].filter(([, list]) => list.length > 0);
  }, [tasks, groupBy]);

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="section-title">Tasks</h1>
          <p className="section-subtitle">{tasks.length} task{tasks.length !== 1 ? "s" : ""} assigned to you</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Group by</span>
          {(["STATUS", "CUSTOMER", "DUE"] as GroupBy[]).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${groupBy === g ? "#6366f1" : "var(--border)"}`,
                background: groupBy === g ? "rgba(99,102,241,0.12)" : "transparent",
                color: groupBy === g ? "#818cf8" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {g === "DUE" ? "Due Date" : g.charAt(0) + g.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="section-card"><div className="empty-state"><div className="loading-spinner" /><p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading tasks…</p></div></div>
      ) : error ? (
        <div className="section-card"><div className="empty-state"><p style={{ fontSize: 14, color: "#ef4444" }}>{error}</p><button onClick={load} className="badge" style={{ marginTop: 10, cursor: "pointer" }}>Retry</button></div></div>
      ) : tasks.length === 0 ? (
        <div className="section-card"><div className="empty-state"><ClipboardList size={44} color="var(--text-muted)" /><p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No tasks assigned to you</p><p style={{ fontSize: 13, color: "var(--text-muted)" }}>Tasks created for your clients will appear here.</p></div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {groups.map(([label, list]) => (
            <div key={label}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <ChevronDown size={14} color="var(--text-muted)" />
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</h2>
                <span className="badge">{list.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {list.map((t) => {
                  const overdue = new Date(t.dueDate) < new Date() && t.status !== "COMPLETED";
                  return (
                    <div key={t.id} className="section-card" style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{t.title}</p>
                            <span className="badge" style={{ background: `${PRIORITY_COLOR[t.priority]}1a`, color: PRIORITY_COLOR[t.priority], borderColor: `${PRIORITY_COLOR[t.priority]}30`, flexShrink: 0 }}>{t.priority}</span>
                          </div>
                          {t.description && <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 }}>{t.description}</p>}
                          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
                            <Link href={`/ca/clients/${t.customer.id}`} style={{ color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>{t.customer.name}</Link>
                            <span style={{ color: overdue ? "#ef4444" : "var(--text-muted)" }}>Due {format(new Date(t.dueDate), "dd MMM yyyy")}</span>
                          </div>
                        </div>
                        <select
                          value={t.status}
                          onChange={(e) => updateStatus(t.id, e.target.value)}
                          style={{ fontSize: 12, padding: "6px 10px", background: "var(--bg-elevated)", border: `1px solid ${STATUS_COLOR[t.status]}40`, borderRadius: 7, color: STATUS_COLOR[t.status], fontWeight: 600, cursor: "pointer", outline: "none", flexShrink: 0 }}
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
