"use client";

import { useEffect, useState } from "react";
import { HandCoins, AlertTriangle, Wallet, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui/section-card";
import { StatGrid } from "@/components/ui/stat-grid";
import { StatusBadge } from "@/components/ui/status-badge";

interface AdminLendingData {
  applicationsByStatus: { status: string; count: number }[];
  verificationQueueSize: number;
  accounts: { total: number; totalOutstanding: string; totalDisbursedEver: string };
  npa: { count: number; outstanding: string; percentOfPortfolio: string };
  disbursementsByStatus: { status: string; count: number; amount: string }[];
  collectionsByBucket: { bucket: string; count: number }[];
  verificationCasesByStatus: { status: string; count: number }[];
  verificationChecksByType: { checkType: string; count: number }[];
  recentApplications: {
    id: string; applicationNumber: string; organizationName: string; customerName: string;
    productName: string; requestedAmount: string; status: string; stage: string; createdAt: string;
  }[];
}

interface AdminCreditUsage {
  pullsByProvider: { provider: string; count: number }[];
  pullsByStatus: { status: string; count: number }[];
  apiLogStats: { provider: string; success: boolean; count: number; avgDurationMs: number }[];
  last30DaysPulls: number;
}

function fmt(v: unknown) {
  const n = Number(v);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function AdminLendingPage() {
  const [data, setData] = useState<AdminLendingData | null>(null);
  const [creditUsage, setCreditUsage] = useState<AdminCreditUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/lending")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => toast.error("Failed to load platform lending data"))
      .finally(() => setLoading(false));

    fetch("/api/admin/credit/usage")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setCreditUsage)
      .catch(() => toast.error("Failed to load credit bureau usage"));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <HandCoins size={22} /> Lending Platform
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Cross-tenant view of every organization&apos;s loan origination activity</p>
      </div>

      {loading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}

      {data && (
        <>
          <StatGrid
            columns={4}
            stats={[
              { label: "Active Loan Accounts", value: data.accounts.total, icon: <HandCoins size={20} />, color: "#6366f1" },
              { label: "Outstanding Portfolio", value: fmt(data.accounts.totalOutstanding), icon: <Wallet size={20} />, color: "#10b981" },
              { label: "NPA", value: `${fmt(data.npa.outstanding)} (${data.npa.percentOfPortfolio}%)`, icon: <AlertTriangle size={20} />, color: "#ef4444" },
              { label: "Verification Queue", value: data.verificationQueueSize, icon: <ClipboardList size={20} />, color: "#f59e0b" },
            ]}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            <SectionCard title="Applications by Status">
              {data.applicationsByStatus.map((s) => (
                <div key={s.status} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--border)" }}>
                  <StatusBadge status={s.status} /><span style={{ fontWeight: 600 }}>{s.count}</span>
                </div>
              ))}
            </SectionCard>
            <SectionCard title="Disbursements by Status">
              {data.disbursementsByStatus.map((d) => (
                <div key={d.status} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--border)" }}>
                  <StatusBadge status={d.status} /><span>{d.count} · {fmt(d.amount)}</span>
                </div>
              ))}
            </SectionCard>
          </div>

          <SectionCard title="Risk Distribution — Open Collection Cases by DPD Bucket">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
              {data.collectionsByBucket.map((b) => (
                <div key={b.bucket} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, textAlign: "center" }}>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>{b.bucket.replace(/_/g, " ")}</p>
                  <p style={{ fontSize: 18, fontWeight: 700 }}>{b.count}</p>
                </div>
              ))}
              {data.collectionsByBucket.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No open collection cases across the platform.</p>}
            </div>
          </SectionCard>

          <SectionCard title="Background Verification (Module 5)" description="Cross-tenant case and check volume">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Cases by Status</p>
                {data.verificationCasesByStatus.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No verification cases yet.</p>}
                {data.verificationCasesByStatus.map((v) => (
                  <div key={v.status} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--border)" }}>
                    <StatusBadge status={v.status} /><span style={{ fontWeight: 600 }}>{v.count}</span>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Checks by Type</p>
                {data.verificationChecksByType.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No checks run yet.</p>}
                {data.verificationChecksByType.map((v) => (
                  <div key={v.checkType} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--border)" }}>
                    <span>{v.checkType.replace(/_/g, " ")}</span><span style={{ fontWeight: 600 }}>{v.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Credit Bureau Usage" description={creditUsage ? `${creditUsage.last30DaysPulls} pull(s) in the last 30 days across the platform` : undefined}>
            {!creditUsage ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</p>
            ) : creditUsage.pullsByProvider.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No credit bureau pulls yet.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {creditUsage.pullsByProvider.map((p) => {
                  const successStat = creditUsage.apiLogStats.find((s) => s.provider === p.provider && s.success);
                  return (
                    <div key={p.provider} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>{p.provider}</p>
                      <p style={{ fontSize: 18, fontWeight: 700 }}>{p.count}</p>
                      {successStat && <p style={{ fontSize: 10, color: "var(--text-muted)" }}>avg {successStat.avgDurationMs}ms</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent Applications (Platform-Wide)">
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "6px 8px" }}>Application</th>
                  <th style={{ padding: "6px 8px" }}>Organization</th>
                  <th style={{ padding: "6px 8px" }}>Customer</th>
                  <th style={{ padding: "6px 8px" }}>Amount</th>
                  <th style={{ padding: "6px 8px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentApplications.map((a) => (
                  <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px" }}>{a.applicationNumber}</td>
                    <td style={{ padding: "8px" }}>{a.organizationName}</td>
                    <td style={{ padding: "8px" }}>{a.customerName}</td>
                    <td style={{ padding: "8px" }}>{fmt(a.requestedAmount)}</td>
                    <td style={{ padding: "8px" }}><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </>
      )}
    </div>
  );
}
