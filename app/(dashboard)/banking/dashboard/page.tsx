"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle2, Clock, RefreshCw, Zap,
  Building2, ShieldAlert, BrainCircuit, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────
interface DashboardData {
  kpis: {
    totalBalance: number;
    availableBalance: number;
    monthlyInflow: number;
    monthlyOutflow: number;
    netCashFlow: number;
    pendingReconciliation: number;
    unmatchedTxns: number;
    connectedAccounts: number;
    inflowChange: number;
    outflowChange: number;
  };
  cashFlowTrend: { date: string; inflow: number; outflow: number; net: number }[];
  bankDistribution: { name: string; balance: number; color: string }[];
  recentTxns: {
    id: string; narration: string; amount: number; type: "credit" | "debit";
    bank: string; date: string; category: string; status: string;
  }[];
  reconciliationProgress: { matched: number; unmatched: number; exceptions: number };
  bankHealth: { bank: string; score: number; status: string; lastSync: string }[];
  aiInsights: { id: string; title: string; summary: string; severity: string }[];
  consentAlerts: { bank: string; expiresIn: number; status: string }[];
}

// ── Mock data (replace with real API) ───────────────────────
const MOCK: DashboardData = {
  kpis: {
    totalBalance: 28540000, availableBalance: 26100000,
    monthlyInflow: 12300000, monthlyOutflow: 8700000,
    netCashFlow: 3600000, pendingReconciliation: 47,
    unmatchedTxns: 23, connectedAccounts: 6,
    inflowChange: 14.2, outflowChange: -6.8,
  },
  cashFlowTrend: [
    { date: "01 Jun", inflow: 1200000, outflow: 890000, net: 310000 },
    { date: "02 Jun", inflow: 980000,  outflow: 740000, net: 240000 },
    { date: "03 Jun", inflow: 1450000, outflow: 920000, net: 530000 },
    { date: "04 Jun", inflow: 820000,  outflow: 1100000, net: -280000 },
    { date: "05 Jun", inflow: 1680000, outflow: 750000, net: 930000 },
    { date: "06 Jun", inflow: 1120000, outflow: 880000, net: 240000 },
    { date: "07 Jun", inflow: 1940000, outflow: 1020000, net: 920000 },
    { date: "08 Jun", inflow: 1350000, outflow: 960000, net: 390000 },
    { date: "09 Jun", inflow: 1080000, outflow: 840000, net: 240000 },
    { date: "10 Jun", inflow: 1620000, outflow: 720000, net: 900000 },
  ],
  bankDistribution: [
    { name: "HDFC Bank", balance: 12400000, color: "#6366f1" },
    { name: "ICICI Bank", balance: 8200000, color: "#10b981" },
    { name: "SBI", balance: 4700000, color: "#f59e0b" },
    { name: "Axis Bank", balance: 3240000, color: "#ef4444" },
  ],
  recentTxns: [
    { id: "1", narration: "NEFT/Rajesh Traders/INV-2421", amount: 487500, type: "credit", bank: "HDFC", date: "10 Jun", category: "Customer Receipt", status: "UNREVIEWED" },
    { id: "2", narration: "UPI/Swiggy Business/FOOD-89", amount: 12400, type: "debit", bank: "ICICI", date: "10 Jun", category: "Staff Welfare", status: "CATEGORIZED" },
    { id: "3", narration: "GST/PMT-06/CGST-2025-06", amount: 184200, type: "debit", bank: "HDFC", date: "09 Jun", category: "GST Payment", status: "MATCHED" },
    { id: "4", narration: "RTGS/Amazon Web Services", amount: 56000, type: "debit", bank: "AXIS", date: "09 Jun", category: "Cloud & Software", status: "CATEGORIZED" },
    { id: "5", narration: "IMPS/Salary June 2026/PAYROLL", amount: 2340000, type: "debit", bank: "SBI", date: "08 Jun", category: "Payroll", status: "MATCHED" },
    { id: "6", narration: "NEFT/Sunrise Exports Ltd", amount: 924000, type: "credit", bank: "HDFC", date: "08 Jun", category: "Customer Receipt", status: "UNREVIEWED" },
  ],
  reconciliationProgress: { matched: 487, unmatched: 47, exceptions: 12 },
  bankHealth: [
    { bank: "HDFC Bank", score: 98, status: "Excellent", lastSync: "2 mins ago" },
    { bank: "ICICI Bank", score: 95, status: "Excellent", lastSync: "5 mins ago" },
    { bank: "SBI", score: 72, status: "Fair", lastSync: "1 hr ago" },
    { bank: "Axis Bank", score: 88, status: "Good", lastSync: "15 mins ago" },
  ],
  aiInsights: [
    { id: "1", title: "Vendor payments up 18%", summary: "Vendor outflows increased ₹3.2L vs last month. Top drivers: AWS (↑₹56K), raw material (↑₹1.8L).", severity: "warning" },
    { id: "2", title: "Cash crunch in 14 days", summary: "At current burn rate, available balance may fall below ₹50L threshold around Jun 24.", severity: "critical" },
    { id: "3", title: "GST liability due Jun 20", summary: "Estimated CGST+SGST liability ₹2.84L based on current sales. Ensure funds are available.", severity: "info" },
  ],
  consentAlerts: [
    { bank: "SBI", expiresIn: 5, status: "EXPIRING" },
    { bank: "Kotak Mahindra", expiresIn: -2, status: "EXPIRED" },
  ],
};

// ── Utility ──────────────────────────────────────────────────
function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  critical: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", border: "rgba(239,68,68,0.25)", icon: "⚡" },
  warning:  { bg: "rgba(245,158,11,0.08)", text: "#f59e0b", border: "rgba(245,158,11,0.25)", icon: "⚠" },
  info:     { bg: "rgba(99,102,241,0.08)", text: "#818cf8", border: "rgba(99,102,241,0.25)", icon: "ℹ" },
};

function healthColor(score: number) {
  if (score >= 90) return "#10b981";
  if (score >= 70) return "#f59e0b";
  return "#ef4444";
}

// ── KPI Card ─────────────────────────────────────────────────
function KPICard({
  label, value, change, changeLabel, icon: Icon, accent, sub,
}: {
  label: string; value: string; change?: number; changeLabel?: string;
  icon: React.ElementType; accent: string; sub?: string;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </p>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={accent} strokeWidth={2} />
        </div>
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</p>}
      {change !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {positive ? <ArrowUpRight size={12} color="#10b981" /> : <ArrowDownRight size={12} color="#ef4444" />}
          <span style={{ fontSize: 11, fontWeight: 600, color: positive ? "#10b981" : "#ef4444" }}>
            {Math.abs(change)}%
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{changeLabel ?? "vs last month"}</span>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function BankingDashboard() {
  const [data] = useState<DashboardData>(MOCK);
  const [dateFilter, setDateFilter] = useState("this_month");
  const total = data.reconciliationProgress.matched + data.reconciliationProgress.unmatched + data.reconciliationProgress.exceptions;
  const matchPct = Math.round((data.reconciliationProgress.matched / total) * 100);

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Banking Dashboard</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Real-time financial intelligence across all accounts</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_fy">FY 2025–26</option>
          </select>
          <button
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}
          >
            <RefreshCw size={12} />
            Sync All
          </button>
        </div>
      </div>

      {/* Consent & Risk Alerts ──────────────────────── */}
      {(data.consentAlerts.length > 0) && (
        <div style={{ display: "flex", gap: 8 }}>
          {data.consentAlerts.map((a, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              borderRadius: 8, border: `1px solid ${a.status === "EXPIRED" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
              background: a.status === "EXPIRED" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)",
              fontSize: 12,
            }}>
              <AlertTriangle size={12} color={a.status === "EXPIRED" ? "#ef4444" : "#f59e0b"} />
              <span style={{ color: "var(--text-primary)" }}>
                <b>{a.bank}</b> consent {a.status === "EXPIRED" ? `expired ${Math.abs(a.expiresIn)}d ago` : `expiring in ${a.expiresIn}d`}
              </span>
              <button style={{ fontSize: 11, color: "#6366f1", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                Renew
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid ───────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPICard label="Total Bank Balance" value={formatINR(data.kpis.totalBalance)} icon={Wallet} accent="#6366f1" sub={`Available: ${formatINR(data.kpis.availableBalance)}`} />
        <KPICard label="Monthly Inflow" value={formatINR(data.kpis.monthlyInflow)} change={data.kpis.inflowChange} icon={TrendingUp} accent="#10b981" />
        <KPICard label="Monthly Outflow" value={formatINR(data.kpis.monthlyOutflow)} change={data.kpis.outflowChange} icon={TrendingDown} accent="#ef4444" />
        <KPICard label="Net Cash Flow" value={formatINR(data.kpis.netCashFlow)} icon={Activity} accent="#f59e0b" sub="This month" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPICard label="Pending Reconciliation" value={String(data.kpis.pendingReconciliation)} icon={GitMerge as React.ElementType} accent="#8b5cf6" sub="transactions" />
        <KPICard label="Unmatched Transactions" value={String(data.kpis.unmatchedTxns)} icon={AlertTriangle} accent="#f43f5e" sub="need attention" />
        <KPICard label="Connected Accounts" value={String(data.kpis.connectedAccounts)} icon={Building2} accent="#06b6d4" sub="across 4 banks" />
        <KPICard label="Reconciliation Rate" value={`${matchPct}%`} icon={CheckCircle2} accent="#10b981" sub={`${data.reconciliationProgress.matched} of ${total} matched`} />
      </div>

      {/* Charts Row 1 ───────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Cash Flow Trend */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Cash Flow Trend</h3>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Daily inflow vs outflow</p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {[["#10b981", "Inflow"], ["#ef4444", "Outflow"], ["#6366f1", "Net"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.cashFlowTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => formatINR(Number(v ?? 0))}
              />
              <Area type="monotone" dataKey="inflow" stroke="#10b981" fill="url(#inflowGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="outflow" stroke="#ef4444" fill="url(#outflowGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="net" stroke="#6366f1" fill="none" strokeWidth={2} strokeDasharray="4 2" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bank Distribution */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Bank Distribution</h3>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Balance by bank</p>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={data.bankDistribution} dataKey="balance" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3}>
                {data.bankDistribution.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatINR(Number(v ?? 0))} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {data.bankDistribution.map((b) => (
              <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, flex: 1, color: "var(--text-secondary)" }}>{b.name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{formatINR(b.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Recent Transactions */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Recent Transactions</h3>
            <a href="/banking/transactions" style={{ fontSize: 12, color: "#6366f1", textDecoration: "none" }}>View all →</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {data.recentTxns.map((txn, i) => (
              <div key={txn.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderBottom: i < data.recentTxns.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: txn.type === "credit" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {txn.type === "credit"
                    ? <ArrowUpRight size={14} color="#10b981" />
                    : <ArrowDownRight size={14} color="#ef4444" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {txn.narration}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{txn.bank} · {txn.date} · {txn.category}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: txn.type === "credit" ? "#10b981" : "#ef4444" }}>
                    {txn.type === "credit" ? "+" : "-"}{formatINR(txn.amount)}
                  </p>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                    background: txn.status === "MATCHED" ? "rgba(16,185,129,0.12)" : txn.status === "CATEGORIZED" ? "rgba(99,102,241,0.12)" : "rgba(245,158,11,0.12)",
                    color: txn.status === "MATCHED" ? "#10b981" : txn.status === "CATEGORIZED" ? "#818cf8" : "#f59e0b",
                  }}>
                    {txn.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Reconciliation Progress */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Reconciliation Progress</h3>
            <div style={{ display: "flex", gap: 3, height: 8, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ flex: data.reconciliationProgress.matched, background: "#10b981" }} />
              <div style={{ flex: data.reconciliationProgress.unmatched, background: "#f59e0b" }} />
              <div style={{ flex: data.reconciliationProgress.exceptions, background: "#ef4444" }} />
            </div>
            {[
              ["Matched", data.reconciliationProgress.matched, "#10b981"],
              ["Unmatched", data.reconciliationProgress.unmatched, "#f59e0b"],
              ["Exceptions", data.reconciliationProgress.exceptions, "#ef4444"],
            ].map(([l, v, c]) => (
              <div key={String(l)} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: String(c) }} />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{l}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{v}</span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "#10b981", fontWeight: 600, marginTop: 4 }}>{matchPct}% reconciled</p>
          </div>

          {/* AI Insights */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <BrainCircuit size={13} color="#818cf8" />
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>AI Insights</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.aiInsights.map((ins) => {
                const s = SEVERITY_STYLES[ins.severity];
                return (
                  <div key={ins.id} style={{ padding: "8px 10px", borderRadius: 8, background: s.bg, border: `1px solid ${s.border}` }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: s.text }}>{s.icon} {ins.title}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>{ins.summary}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bank Health ────────────────────────────────── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Bank Health Scores</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {data.bankHealth.map((b) => {
            const c = healthColor(b.score);
            return (
              <div key={b.bank} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-hover)" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{b.bank}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: c }}>{b.score}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/100</span>
                </div>
                <div style={{ height: 4, borderRadius: 4, background: "var(--border)", marginBottom: 6 }}>
                  <div style={{ height: 4, borderRadius: 4, background: c, width: `${b.score}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: c }}>{b.status}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                    <Clock size={9} />
                    {b.lastSync}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

function GitMerge(props: React.SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }) {
  const { size = 24, strokeWidth = 2, ...rest } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  );
}
