"use client";

import Link from "next/link";
import { Radar } from "lucide-react";
import { useQuery } from "@/lib/queryCache";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatusBadge } from "@/components/ui/status-badge";

interface AlertRow {
  id: string;
  ruleType: string;
  subjectType: string;
  subjectLabel: string;
  severity: string;
  status: string;
  title: string;
  triggeredAt: string;
}

async function api(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function MonitoringDashboardPage() {
  const { data, isLoading } = useQuery<{ alerts: AlertRow[] }>(["monitoring", "alerts-all"], () => api("/api/monitoring/alerts"));

  const alerts = data?.alerts ?? [];
  const open = alerts.filter((a) => a.status === "OPEN");
  const highCritical = alerts.filter((a) => a.severity === "HIGH" || a.severity === "CRITICAL");
  const escalated = alerts.filter((a) => a.status === "ESCALATED");

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Monitoring Dashboard</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Transaction, repayment, credit, and cross-module compliance alerts</p>

      {isLoading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <>
          <StatGrid
            columns={3}
            stats={[
              { label: "Open Alerts", value: open.length, icon: <Radar size={20} />, color: "#f59e0b" },
              { label: "High / Critical", value: highCritical.length, icon: <Radar size={20} />, color: "#ef4444" },
              { label: "Escalated to Case", value: escalated.length, icon: <Radar size={20} />, color: "#8b5cf6" },
            ]}
          />

          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", background: "var(--bg-base)" }}>
                  <th style={{ padding: "10px 16px" }}>Alert</th>
                  <th style={{ padding: "10px 16px" }}>Subject</th>
                  <th style={{ padding: "10px 16px" }}>Severity</th>
                  <th style={{ padding: "10px 16px" }}>Status</th>
                  <th style={{ padding: "10px 16px" }}>Triggered</th>
                </tr>
              </thead>
              <tbody>
                {alerts.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No alerts yet.</td></tr>
                )}
                {alerts.slice(0, 20).map((a) => (
                  <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href="/monitoring/alerts" style={{ color: "#818cf8", fontWeight: 600, textDecoration: "none" }}>{a.title}</Link>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{a.subjectType.replace(/_/g, " ")} — {a.subjectLabel}</td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={a.severity} /></td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={a.status} /></td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{new Date(a.triggeredAt).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
