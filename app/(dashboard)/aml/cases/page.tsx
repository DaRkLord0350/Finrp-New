"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

interface AMLCaseRow {
  id: string; caseNumber: string; subjectName: string; status: string; riskRating: string; openedAt: string;
  alerts: { severity: string }[];
}

async function api(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

const STATUS_OPTIONS = ["All", "OPEN", "UNDER_REVIEW", "ESCALATED", "CLEARED", "CONFIRMED_SAR", "CLOSED"];

export default function AMLCasesPage() {
  const [status, setStatus] = useState("All");
  const { data, isLoading } = useQuery<{ cases: AMLCaseRow[] }>(["aml", "cases", status], () =>
    api(`/api/aml/cases${status !== "All" ? `?status=${status}` : ""}`)
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>AML Cases</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-surface)", fontSize: 13 }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

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
            {isLoading && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>}
            {!isLoading && (data?.cases?.length ?? 0) === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No cases found.</td></tr>
            )}
            {data?.cases?.map((c) => (
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
    </div>
  );
}
