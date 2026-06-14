"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertTriangle, Activity, Clock, CheckCircle, XCircle, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionCard } from "@/components/ui/section-card";

type QueueStats = { name: string; waiting: number; active: number; completed: number; failed: number; delayed: number };
type DlqJob = { id: string; originalQueue: string; errorMessage: string; failedAt: string; attemptsMade: number; organizationId?: string };
type ImportJob = { id: string; status: string; entity: string; totalRows: number; processedRows: number; createdAt: string; organizationId: string };
type StuckJob = { id: string; status: string; entity: string; createdAt: string; updatedAt: string };

type JobData = {
  queues: QueueStats[];
  dlq: { depth: number; jobs: DlqJob[] };
  activeImports: ImportJob[];
  stuckJobs: StuckJob[];
  totalFailed: number;
  totalActive: number;
  totalWaiting: number;
};

const QUEUE_COLORS: Record<string, string> = { import: "#6366f1", sync: "#10b981", webhook: "#3b82f6" };

export default function AdminJobsPage() {
  const [data, setData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/jobs");
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      toast.error("Failed to load job data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doAction(action: string, jobId: string, label: string) {
    setActing(jobId);
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, jobId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`${label} succeeded`);
      await load();
    } catch {
      toast.error(`${label} failed`);
    } finally {
      setActing(null);
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Worker Observability</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Queue depths, failed jobs, and stuck workers</p>
        </div>
        <button
          onClick={load}
          className="btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary Metrics */}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Total Active", value: data.totalActive, icon: <Activity size={18} />, color: "#10b981" },
            { label: "Total Waiting", value: data.totalWaiting, icon: <Clock size={18} />, color: "#f59e0b" },
            { label: "Total Failed", value: data.totalFailed, icon: <XCircle size={18} />, color: "#ef4444" },
          ].map((m) => (
            <div key={m.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${m.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: m.color, marginBottom: 12 }}>
                {m.icon}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{m.label}</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Queue Details */}
      <SectionCard title="Queue Status" icon={<Activity size={16} />}>
        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {data?.queues.map((q) => {
              const color = QUEUE_COLORS[q.name] ?? "#6b7280";
              return (
                <div key={q.name} style={{ padding: 16, background: "var(--bg-elevated)", borderRadius: 10, border: `1px solid ${color}30` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{q.name}</span>
                  </div>
                  {[
                    { label: "Waiting", value: q.waiting, color: "#f59e0b" },
                    { label: "Active", value: q.active, color: "#10b981" },
                    { label: "Delayed", value: q.delayed, color: "#8b5cf6" },
                    { label: "Failed", value: q.failed, color: "#ef4444" },
                    { label: "Completed", value: q.completed, color: "#6b7280" },
                  ].map((s) => (
                    <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: s.value > 0 ? s.color : "var(--text-muted)" }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* DLQ */}
      <SectionCard
        title={`Dead Letter Queue (${data?.dlq.depth ?? 0})`}
        icon={<AlertTriangle size={16} />}
        actions={data?.dlq.depth ? (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            {data.dlq.depth} jobs need attention
          </span>
        ) : undefined}
      >
        {!data?.dlq.jobs.length ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#10b981", fontSize: 14 }}>
            <CheckCircle size={16} /> DLQ is empty
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Queue", "Error", "Failed At", "Retries", "Actions"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.dlq.jobs.map((j) => (
                <tr key={j.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 12 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, background: `${QUEUE_COLORS[j.originalQueue] ?? "#6b7280"}18`, color: QUEUE_COLORS[j.originalQueue] ?? "#6b7280", fontWeight: 600, fontSize: 11 }}>
                      {j.originalQueue}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#ef4444", maxWidth: 300 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.errorMessage}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(j.failedAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>{j.attemptsMade}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      onClick={() => doAction("retry_dlq", j.id, "Retry")}
                      disabled={acting === j.id}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      <RotateCcw size={12} /> Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Stuck Jobs */}
      {(data?.stuckJobs.length ?? 0) > 0 && (
        <SectionCard title={`Stuck Jobs (${data!.stuckJobs.length})`} icon={<Clock size={16} />}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["ID", "Entity", "Status", "Last Update", "Actions"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.stuckJobs.map((j) => (
                <tr key={j.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{j.id.slice(0, 12)}…</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)" }}>{j.entity}</td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={j.status} /></td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#f59e0b" }}>{new Date(j.updatedAt).toLocaleString()}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      onClick={() => doAction("clear_stuck", j.id, "Clear")}
                      disabled={acting === j.id}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      <Trash2 size={12} /> Clear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      {/* Active Imports */}
      <SectionCard title="Active Import Jobs" icon={<Activity size={16} />}>
        {!data?.activeImports.length ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No active imports</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["ID", "Entity", "Status", "Progress", "Started"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.activeImports.map((j) => {
                const pct = j.totalRows > 0 ? Math.round((j.processedRows / j.totalRows) * 100) : 0;
                return (
                  <tr key={j.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{j.id.slice(0, 12)}…</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)" }}>{j.entity}</td>
                    <td style={{ padding: "10px 12px" }}><StatusBadge status={j.status} /></td>
                    <td style={{ padding: "10px 12px", minWidth: 160 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "#6366f1", transition: "width 0.5s" }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>{new Date(j.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
