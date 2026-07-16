"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
function fmt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "—";
}

interface CollectionCase {
  id: string;
  bucket: string;
  overdueAmount: string;
  overdueDays: number;
  status: string;
  loanAccount: { accountNumber: string; customer: { name: string } };
}

const BUCKET_COLORS: Record<string, string> = {
  CURRENT: "#10b981", DPD_1_30: "#f59e0b", DPD_31_60: "#f97316", DPD_61_90: "#ef4444", DPD_90_PLUS: "#b91c1c", NPA: "#7f1d1d",
};

export default function CollectionsPage() {
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ cases: CollectionCase[]; buckets: Record<string, { count: number; amount: string }> }>(
    ["lending", "collections", bucketFilter],
    () => api(`/api/lending/collections${bucketFilter ? `?bucket=${bucketFilter}` : ""}`)
  );
  const refresh = () => qc.invalidate(["lending", "collections", bucketFilter]);

  const logActivity = async (caseId: string) => {
    const notes = window.prompt("Activity notes (call/SMS/email/visit)?");
    if (!notes) return;
    try {
      await api(`/api/lending/collections/${caseId}/activities`, { method: "POST", body: JSON.stringify({ activityType: "CALL", notes }) });
      toast.success("Activity logged");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const patch = async (caseId: string, action: string) => {
    try {
      await api(`/api/lending/collections/${caseId}`, { method: "PATCH", body: JSON.stringify({ action }) });
      toast.success(`Case ${action}d`);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Collections</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>DPD buckets, overdue cases, and collection activity</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 24 }}>
        {Object.entries(data?.buckets ?? {}).map(([bucket, b]) => (
          <button
            key={bucket}
            onClick={() => setBucketFilter(bucketFilter === bucket ? null : bucket)}
            style={{
              textAlign: "left", padding: 14, borderRadius: 12, cursor: "pointer",
              border: `1px solid ${bucketFilter === bucket ? BUCKET_COLORS[bucket] : "var(--border)"}`,
              background: "var(--bg-surface)",
            }}
          >
            <p style={{ fontSize: 10, color: BUCKET_COLORS[bucket], fontWeight: 700, textTransform: "uppercase" }}>{bucket.replace(/_/g, " ")}</p>
            <p style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{b.count}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmt(b.amount)}</p>
          </button>
        ))}
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", background: "var(--bg-base)" }}>
              <th style={{ padding: "10px 16px" }}>Account</th>
              <th style={{ padding: "10px 16px" }}>Customer</th>
              <th style={{ padding: "10px 16px" }}>Bucket</th>
              <th style={{ padding: "10px 16px" }}>Overdue</th>
              <th style={{ padding: "10px 16px" }}>Days</th>
              <th style={{ padding: "10px 16px" }}>Status</th>
              <th style={{ padding: "10px 16px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>}
            {!isLoading && (data?.cases?.length ?? 0) === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                <AlertTriangle size={20} style={{ marginBottom: 6, opacity: 0.4 }} /><br />No open collection cases.
              </td></tr>
            )}
            {data?.cases?.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px" }}>{c.loanAccount.accountNumber}</td>
                <td style={{ padding: "12px 16px" }}>{c.loanAccount.customer.name}</td>
                <td style={{ padding: "12px 16px", color: BUCKET_COLORS[c.bucket] }}>{c.bucket.replace(/_/g, " ")}</td>
                <td style={{ padding: "12px 16px" }}>{fmt(c.overdueAmount)}</td>
                <td style={{ padding: "12px 16px" }}>{c.overdueDays}</td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={c.status} /></td>
                <td style={{ padding: "12px 16px", display: "flex", gap: 6 }}>
                  <button onClick={() => logActivity(c.id)} style={smallBtn}>Log Activity</button>
                  <button onClick={() => patch(c.id, "escalate")} style={smallBtn}>Escalate</button>
                  <button onClick={() => patch(c.id, "resolve")} style={smallBtn}>Resolve</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const smallBtn: React.CSSProperties = { padding: "5px 9px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" };
