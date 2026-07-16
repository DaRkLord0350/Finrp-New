"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useQuery } from "@/lib/queryCache";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatusBadge } from "@/components/ui/status-badge";

interface AMLCaseRow {
  id: string;
  caseNumber: string;
  subjectName: string;
  status: string;
  riskRating: string;
  openedAt: string;
  alerts: { severity: string }[];
}

async function api(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function AMLDashboardPage() {
  const { data, isLoading } = useQuery<{ cases: AMLCaseRow[] }>(["aml", "cases-all"], () => api("/api/aml/cases"));

  const cases = data?.cases ?? [];
  const open = cases.filter((c) => ["OPEN", "UNDER_REVIEW", "ESCALATED"].includes(c.status));
  const highRisk = cases.filter((c) => c.riskRating === "HIGH" || c.riskRating === "CRITICAL");
  const sarFiled = cases.filter((c) => c.status === "CONFIRMED_SAR");

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>AML Dashboard</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>PEP, sanctions, and negative-media screening case management</p>

      {isLoading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <>
          <StatGrid
            columns={3}
            stats={[
              { label: "Open Cases", value: open.length, icon: <ShieldAlert size={20} />, color: "#f59e0b" },
              { label: "High / Critical Risk", value: highRisk.length, icon: <ShieldAlert size={20} />, color: "#ef4444" },
              { label: "SAR Filed", value: sarFiled.length, icon: <ShieldAlert size={20} />, color: "#7f1d1d" },
            ]}
          />

          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", background: "var(--bg-base)" }}>
                  <th style={{ padding: "10px 16px" }}>Case</th>
                  <th style={{ padding: "10px 16px" }}>Subject</th>
                  <th style={{ padding: "10px 16px" }}>Risk</th>
                  <th style={{ padding: "10px 16px" }}>Alerts</th>
                  <th style={{ padding: "10px 16px" }}>Status</th>
                  <th style={{ padding: "10px 16px" }}>Opened</th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No AML cases yet.</td></tr>
                )}
                {cases.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/aml/cases/${c.id}`} style={{ color: "#818cf8", fontWeight: 600, textDecoration: "none" }}>{c.caseNumber}</Link>
                    </td>
                    <td style={{ padding: "12px 16px" }}>{c.subjectName}</td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={c.riskRating} /></td>
                    <td style={{ padding: "12px 16px" }}>{c.alerts.length}</td>
                    <td style={{ padding: "12px 16px" }}><StatusBadge status={c.status} /></td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{new Date(c.openedAt).toLocaleDateString("en-IN")}</td>
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
