"use client";

import Link from "next/link";
import { HandCoins, TrendingUp, AlertTriangle, Wallet, Plus } from "lucide-react";
import { useQuery } from "@/lib/queryCache";
import { StatGrid } from "@/components/ui/stat-grid";
import { BarChartCard, DonutChart } from "@/components/charts/Charts";
import { StatusBadge } from "@/components/ui/status-badge";

interface PortfolioStats {
  applicationsByStatus: { status: string; count: number }[];
  accountsByStatus: { status: string; count: number; outstanding: string }[];
  portfolio: { activeAccounts: number; totalOutstanding: string; totalDisbursedEver: string };
  npa: { count: number; outstanding: string; percentOfPortfolio: string };
  disbursedThisMonth: { count: number; amount: string };
  collectionsByBucket: { bucket: string; count: number; overdueAmount: string }[];
}

function formatINR(v: string | number) {
  const n = Number(v);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function LendingPortfolioPage() {
  const { data, isLoading } = useQuery<PortfolioStats>(["lending", "portfolio-stats"], async () => {
    const res = await fetch("/api/lending/portfolio/stats");
    if (!res.ok) throw new Error("Failed to load portfolio stats");
    return res.json();
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Lending Portfolio</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Loan Origination System — applications, accounts, and collections at a glance</p>
        </div>
        <Link
          href="/lending/applications/new"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#6366f1", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          <Plus size={15} /> New Application
        </Link>
      </div>

      {isLoading || !data ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading portfolio…</p>
      ) : (
        <>
          <StatGrid
            columns={4}
            stats={[
              { label: "Active Loan Accounts", value: data.portfolio.activeAccounts, icon: <HandCoins size={20} />, color: "#6366f1" },
              { label: "Outstanding Portfolio", value: formatINR(data.portfolio.totalOutstanding), icon: <Wallet size={20} />, color: "#10b981" },
              {
                label: "NPA",
                value: `${formatINR(data.npa.outstanding)} (${data.npa.percentOfPortfolio}%)`,
                icon: <AlertTriangle size={20} />,
                color: "#ef4444",
              },
              { label: "Disbursed This Month", value: formatINR(data.disbursedThisMonth.amount), icon: <TrendingUp size={20} />, color: "#06b6d4" },
            ]}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 24 }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Applications by Status</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Across the full pipeline</p>
              <BarChartCard
                data={data.applicationsByStatus.map((s) => ({ label: s.status, count: s.count }))}
                dataKeys={["count"]}
                currency={false}
              />
            </div>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Collections — DPD Buckets</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Open cases by days-past-due</p>
              {data.collectionsByBucket.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No open collection cases.</p>
              ) : (
                <DonutChart data={data.collectionsByBucket.map((b) => ({ label: b.bucket, value: b.count }))} />
              )}
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Loan Accounts by Status</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ padding: "8px 4px" }}>Status</th>
                  <th style={{ padding: "8px 4px" }}>Accounts</th>
                  <th style={{ padding: "8px 4px" }}>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.accountsByStatus.map((s) => (
                  <tr key={s.status} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 4px" }}><StatusBadge status={s.status} /></td>
                    <td style={{ padding: "10px 4px" }}>{s.count}</td>
                    <td style={{ padding: "10px 4px" }}>{formatINR(s.outstanding)}</td>
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
