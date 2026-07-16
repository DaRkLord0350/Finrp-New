"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

interface AlertRow {
  id: string;
  ruleType: string;
  subjectType: string;
  subjectLabel: string;
  severity: string;
  status: string;
  title: string;
  details: Record<string, unknown>;
  triggeredAt: string;
}

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

const STATUS_OPTIONS = ["All", "OPEN", "ACKNOWLEDGED", "ESCALATED", "RESOLVED", "FALSE_POSITIVE"];

export default function MonitoringAlertsPage() {
  const [status, setStatus] = useState("OPEN");
  const qc = useQueryClient();
  const queryKey = ["monitoring", "alerts", status];
  const { data, isLoading } = useQuery<{ alerts: AlertRow[] }>(queryKey, () => api(`/api/monitoring/alerts${status !== "All" ? `?status=${status}` : ""}`));

  const act = async (id: string, action: "acknowledge" | "dismiss") => {
    try {
      await api(`/api/monitoring/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ action, notes: action === "dismiss" ? window.prompt("Reason?") ?? "" : undefined }) });
      toast.success(`Alert ${action === "acknowledge" ? "acknowledged" : "dismissed"}`);
      qc.invalidate(queryKey);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Alerts</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", fontSize: 13 }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", background: "var(--bg-base)" }}>
              <th style={{ padding: "10px 16px" }}>Alert</th>
              <th style={{ padding: "10px 16px" }}>Subject</th>
              <th style={{ padding: "10px 16px" }}>Severity</th>
              <th style={{ padding: "10px 16px" }}>Status</th>
              <th style={{ padding: "10px 16px" }}>Triggered</th>
              <th style={{ padding: "10px 16px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>}
            {!isLoading && (data?.alerts?.length ?? 0) === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No alerts found.</td></tr>
            )}
            {data?.alerts?.map((a) => (
              <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>{a.title}</td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{a.subjectType.replace(/_/g, " ")} — {a.subjectLabel}</td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={a.severity} /></td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={a.status} /></td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{new Date(a.triggeredAt).toLocaleString("en-IN")}</td>
                <td style={{ padding: "12px 16px" }}>
                  {a.status === "OPEN" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => act(a.id, "acknowledge")} style={secondaryBtn}>Acknowledge</button>
                      <button onClick={() => act(a.id, "dismiss")} style={secondaryBtn}>Dismiss</button>
                    </div>
                  )}
                  {a.status === "ACKNOWLEDGED" && (
                    <button onClick={() => act(a.id, "dismiss")} style={secondaryBtn}>Dismiss</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const secondaryBtn: React.CSSProperties = { padding: "6px 10px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
