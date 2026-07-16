"use client";

import { useQuery } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

interface CreditReportRow {
  id: string;
  provider: string;
  pullType: string;
  status: string;
  subjectType: string;
  createdAt: string;
  applicationId: string | null;
  scores: { score: number; scoreModel: string; riskGrade: string }[];
}

async function api(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function CreditReportsPage() {
  const { data, isLoading } = useQuery<{ reports: CreditReportRow[] }>(["lending", "credit-reports-all"], () => api("/api/credit/reports"));

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Credit Reports</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Every bureau pull made across your loan applications</p>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", background: "var(--bg-base)" }}>
              <th style={{ padding: "10px 16px" }}>Bureau</th>
              <th style={{ padding: "10px 16px" }}>Pull Type</th>
              <th style={{ padding: "10px 16px" }}>Score</th>
              <th style={{ padding: "10px 16px" }}>Risk Grade</th>
              <th style={{ padding: "10px 16px" }}>Status</th>
              <th style={{ padding: "10px 16px" }}>Pulled</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>}
            {!isLoading && (data?.reports?.length ?? 0) === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No credit reports pulled yet — pull one from a loan application&apos;s Credit Bureau tab.</td></tr>
            )}
            {data?.reports?.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.provider}</td>
                <td style={{ padding: "12px 16px" }}>{r.pullType}</td>
                <td style={{ padding: "12px 16px" }}>{r.scores[0]?.score ?? "—"}</td>
                <td style={{ padding: "12px 16px" }}>{r.scores[0]?.riskGrade ? <StatusBadge status={r.scores[0].riskGrade} /> : "—"}</td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={r.status} /></td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
