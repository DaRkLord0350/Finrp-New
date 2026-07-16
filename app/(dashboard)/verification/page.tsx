"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { useQuery } from "@/lib/queryCache";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatusBadge } from "@/components/ui/status-badge";

interface VerificationCaseRow {
  id: string;
  caseNumber: string;
  subjectName: string;
  subjectType: string;
  status: string;
  openedAt: string;
  _count: { checks: number; documents: number };
}

async function api(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function VerificationDashboardPage() {
  const { data, isLoading } = useQuery<{ cases: VerificationCaseRow[] }>(["verification", "cases-all"], () => api("/api/verification/cases"));

  const cases = data?.cases ?? [];
  const open = cases.filter((c) => ["OPEN", "IN_PROGRESS", "ON_HOLD"].includes(c.status));
  const completed = cases.filter((c) => c.status === "COMPLETED");
  const rejected = cases.filter((c) => c.status === "REJECTED");

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Verification Dashboard</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Identity, company, bank, and background verification case management</p>

      {isLoading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <>
          <StatGrid
            columns={3}
            stats={[
              { label: "Open Cases", value: open.length, icon: <BadgeCheck size={20} />, color: "#f59e0b" },
              { label: "Completed", value: completed.length, icon: <BadgeCheck size={20} />, color: "#10b981" },
              { label: "Rejected", value: rejected.length, icon: <BadgeCheck size={20} />, color: "#ef4444" },
            ]}
          />

          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", background: "var(--bg-base)" }}>
                  <th style={{ padding: "10px 16px" }}>Case</th>
                  <th style={{ padding: "10px 16px" }}>Subject</th>
                  <th style={{ padding: "10px 16px" }}>Type</th>
                  <th style={{ padding: "10px 16px" }}>Checks</th>
                  <th style={{ padding: "10px 16px" }}>Status</th>
                  <th style={{ padding: "10px 16px" }}>Opened</th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No verification cases yet.</td></tr>
                )}
                {cases.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/verification/cases/${c.id}`} style={{ color: "#818cf8", fontWeight: 600, textDecoration: "none" }}>{c.caseNumber}</Link>
                    </td>
                    <td style={{ padding: "12px 16px" }}>{c.subjectName}</td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{c.subjectType.replace(/_/g, " ")}</td>
                    <td style={{ padding: "12px 16px" }}>{c._count.checks}</td>
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
