"use client";

import { useState } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle2, Clock, RefreshCw, BrainCircuit,
  Activity, Building2, Plus, Loader2,
} from "lucide-react";
import { useBankDashboard } from "@/hooks/useBankDashboard";
import { useBankSync } from "@/hooks/useBankSync";
import { useQuery } from "@/lib/queryCache";

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

function formatTimeAgo(dateStr: string | null) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function healthLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

function healthColor(score: number) {
  if (score >= 90) return "#10b981";
  if (score >= 70) return "#f59e0b";
  return "#ef4444";
}

const BANK_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#f97316"];

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", border: "rgba(239,68,68,0.25)", icon: "⚡" },
  WARNING:  { bg: "rgba(245,158,11,0.08)", text: "#f59e0b", border: "rgba(245,158,11,0.25)", icon: "⚠" },
  INFO:     { bg: "rgba(99,102,241,0.08)", text: "#818cf8", border: "rgba(99,102,241,0.25)", icon: "ℹ" },
};

function Skeleton({ h = 20, w = "100%" }: { h?: number; w?: string | number }) {
  return (
    <div style={{ height: h, width: w, borderRadius: 4, background: "var(--border)", opacity: 0.6 }} />
  );
}

function KPICard({
  label, value, change, changeLabel, icon: Icon, accent, sub,
}: {
  label: string; value: string; change?: number; changeLabel?: string;
  icon: React.ElementType; accent: string; sub?: string;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12,
      padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
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
            {Math.abs(change).toFixed(1)}%
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{changeLabel ?? "vs last month"}</span>
        </div>
      )}
    </div>
  );
}

export default function BankingDashboard() {
  const [period, setPeriod] = useState("this_month");
  const [syncingAll, setSyncingAll] = useState(false);

  const { kpis, accounts, insights, reconProgress, isLoading, refresh } = useBankDashboard(period);
  const { syncAll, connectSetu } = useBankSync();

  const { data: cfData, isLoading: cfLoading } = useQuery(
    ["banking", "cf-trend", "MONTHLY", "6"],
    async () => {
      const r = await fetch("/api/banking/cash-flow?period=MONTHLY&months=6");
      if (!r.ok) return { snapshots: [] };
      return r.json() as Promise<{ snapshots: Array<{ month?: string; inflow: number; outflow: number; net: number; snapshotDate?: string }> }>;
    },
    { staleTime: 120_000 }
  );

  const { data: txnData, isLoading: txnLoading } = useQuery(
    ["banking", "recent-txns"],
    async () => {
      const r = await fetch("/api/banking/transactions?limit=5&page=1");
      if (!r.ok) return { transactions: [] };
      return r.json() as Promise<{ transactions: Array<{
        id: string; narration: string; credit: number | null; debit: number | null;
        transactionDate: string; category: string | null; status: string;
        bankAccount: { bankName: string };
      }> }>;
    },
    { staleTime: 30_000 }
  );

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      await syncAll();
      setTimeout(() => { refresh(); setSyncingAll(false); }, 5000);
    } catch {
      setSyncingAll(false);
    }
  };

  if (!isLoading && accounts.length === 0) {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 500, gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Building2 size={32} color="#6366f1" />
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Connect your first bank account</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 400, lineHeight: 1.6 }}>
            Link your bank via Account Aggregator to unlock real-time cash flow, reconciliation, and AI-powered insights.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => connectSetu()} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>
            <Plus size={14} /> Connect via Setu AA
          </button>
          <a href="/banking/accounts" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, padding: "10px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", textDecoration: "none" }}>
            Manage Accounts
          </a>
        </div>
      </div>
    );
  }

  // Compute derived data from real accounts
  const bankDistribution = accounts.reduce<Array<{ name: string; balance: number; color: string }>>((acc, a, i) => {
    const ex = acc.find(x => x.name === a.bankName);
    if (ex) ex.balance += a.currentBalance;
    else acc.push({ name: a.bankName, balance: a.currentBalance, color: BANK_COLORS[i % BANK_COLORS.length] });
    return acc;
  }, []).filter(b => b.balance > 0);

  const consentAlerts = accounts.filter(a => a.consentStatus === "EXPIRING" || a.consentStatus === "EXPIRED");

  const total = reconProgress?.totalTxns ?? 0;
  const matched = reconProgress?.matchedTxns ?? 0;
  const unmatched = reconProgress?.unmatchedTxns ?? 0;
  const exceptions = Math.max(0, total - matched - unmatched);
  const matchPct = total > 0 ? Math.round((matched / total) * 100) : 0;

  const cashFlowTrend = (cfData?.snapshots ?? []).map(s => ({
    label: s.month ?? new Date(s.snapshotDate ?? "").toLocaleString("default", { month: "short" }),
    inflow: s.inflow,
    outflow: s.outflow,
    net: s.net,
  }));

  const recentTxns = txnData?.transactions ?? [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Banking Dashboard</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Real-time financial intelligence across all accounts</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_fy">FY 2025–26</option>
          </select>
          <button onClick={handleSyncAll} disabled={syncingAll} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: syncingAll ? "not-allowed" : "pointer", opacity: syncingAll ? 0.7 : 1 }}>
            {syncingAll ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
            {syncingAll ? "Syncing…" : "Sync All"}
          </button>
        </div>
      </div>

      {/* Consent Alerts (real data only) */}
      {consentAlerts.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {consentAlerts.map(a => (
            <a key={a.id} href="/banking/consent" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 8, border: `1px solid ${a.consentStatus === "EXPIRED" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`, background: a.consentStatus === "EXPIRED" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)", fontSize: 12, cursor: "pointer" }}>
                <AlertTriangle size={12} color={a.consentStatus === "EXPIRED" ? "#ef4444" : "#f59e0b"} />
                <span style={{ color: "var(--text-primary)" }}>
                  <b>{a.bankName}</b> consent {a.consentStatus === "EXPIRED" ? "expired" : "expiring soon"}
                </span>
                <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 600 }}>Renew →</span>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* KPI Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {isLoading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, minHeight: 100 }}>
            <Skeleton h={11} w="55%" /><Skeleton h={22} w="45%" />
          </div>
        )) : (
          <>
            <KPICard label="Total Bank Balance" value={formatINR(kpis?.totalBalance ?? 0)} icon={Wallet} accent="#6366f1" sub={`Available: ${formatINR(kpis?.availableBalance ?? 0)}`} />
            <KPICard label="Monthly Inflow" value={formatINR(kpis?.monthlyInflow ?? 0)} icon={TrendingUp} accent="#10b981" />
            <KPICard label="Monthly Outflow" value={formatINR(kpis?.monthlyOutflow ?? 0)} icon={TrendingDown} accent="#ef4444" />
            <KPICard label="Net Cash Flow" value={formatINR(kpis?.netCashFlow ?? 0)} icon={Activity} accent={(kpis?.netCashFlow ?? 0) >= 0 ? "#10b981" : "#ef4444"} sub="This month" />
          </>
        )}
      </div>

      {/* KPI Row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {isLoading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, minHeight: 100 }}>
            <Skeleton h={11} w="55%" /><Skeleton h={22} w="45%" />
          </div>
        )) : (
          <>
            <KPICard label="Pending Reconciliation" value={String(kpis?.pendingReconciliation ?? 0)} icon={GitMergeIcon} accent="#8b5cf6" sub="transactions" />
            <KPICard label="Unmatched Transactions" value={String(kpis?.unmatchedTxns ?? 0)} icon={AlertTriangle} accent="#f43f5e" sub="need attention" />
            <KPICard label="Connected Accounts" value={String(kpis?.connectedAccounts ?? 0)} icon={Building2} accent="#06b6d4" sub={bankDistribution.length > 1 ? `across ${bankDistribution.length} banks` : "bank account"} />
            <KPICard label="Reconciliation Rate" value={`${matchPct}%`} icon={CheckCircle2} accent="#10b981" sub={total > 0 ? `${matched} of ${total} matched` : "No sessions yet"} />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Cash Flow Trend */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Cash Flow Trend</h3>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Monthly inflow vs outflow</p>
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
          {cfLoading ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={20} color="var(--text-muted)" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : cashFlowTrend.length === 0 ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
              <Activity size={24} color="var(--text-muted)" />
              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>No cash flow data yet.<br />Sync your accounts to see trends.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cashFlowTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="infGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={v => formatINR(Number(v ?? 0))} />
                <Area type="monotone" dataKey="inflow" stroke="#10b981" fill="url(#infGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="outflow" stroke="#ef4444" fill="url(#outGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="net" stroke="#6366f1" fill="none" strokeWidth={2} strokeDasharray="4 2" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bank Distribution */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Bank Distribution</h3>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Balance by bank</p>
          </div>
          {isLoading ? (
            <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={20} color="var(--text-muted)" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : bankDistribution.length === 0 ? (
            <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No accounts connected</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={bankDistribution} dataKey="balance" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3}>
                    {bankDistribution.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={v => formatINR(Number(v ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {bankDistribution.map(b => (
                  <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, flex: 1, color: "var(--text-secondary)" }}>{b.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{formatINR(b.balance)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Recent Transactions */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Recent Transactions</h3>
            <a href="/banking/transactions" style={{ fontSize: 12, color: "#6366f1", textDecoration: "none" }}>View all →</a>
          </div>
          {txnLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={44} />)}
            </div>
          ) : recentTxns.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 120, gap: 8 }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No transactions yet. Sync your accounts to see data.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentTxns.map((txn, i) => {
                const isCredit = txn.credit !== null && txn.credit > 0;
                return (
                  <div key={txn.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < recentTxns.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: isCredit ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isCredit ? <ArrowUpRight size={14} color="#10b981" /> : <ArrowDownRight size={14} color="#ef4444" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txn.narration}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {txn.bankAccount.bankName} · {new Date(txn.transactionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{txn.category ? ` · ${txn.category}` : ""}
                      </p>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: isCredit ? "#10b981" : "#ef4444" }}>
                      {isCredit ? "+" : "−"}{formatINR(isCredit ? (txn.credit ?? 0) : (txn.debit ?? 0))}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Reconciliation Progress */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Reconciliation Progress</h3>
            {total === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No reconciliation sessions yet.</p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 3, height: 8, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ flex: matched || 0.001, background: "#10b981", minWidth: matched > 0 ? 4 : 0 }} />
                  <div style={{ flex: unmatched || 0.001, background: "#f59e0b", minWidth: unmatched > 0 ? 4 : 0 }} />
                  <div style={{ flex: exceptions || 0.001, background: "#ef4444", minWidth: exceptions > 0 ? 4 : 0 }} />
                </div>
                {[["Matched", matched, "#10b981"], ["Unmatched", unmatched, "#f59e0b"], ["Exceptions", exceptions, "#ef4444"]].map(([l, v, c]) => (
                  <div key={String(l)} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: String(c) }} />
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{l}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{v}</span>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: "#10b981", fontWeight: 600, marginTop: 4 }}>{matchPct}% reconciled</p>
              </>
            )}
          </div>

          {/* AI Insights */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <BrainCircuit size={13} color="#818cf8" />
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>AI Insights</h3>
              </div>
              <a href="/banking/ai-insights" style={{ fontSize: 11, color: "#6366f1", textDecoration: "none" }}>View all →</a>
            </div>
            {insights.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No insights yet. Sync accounts to generate.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {insights.slice(0, 3).map(ins => {
                  const sev = ((ins.severity ?? "INFO") as string).toUpperCase() as keyof typeof SEVERITY_STYLES;
                  const s = SEVERITY_STYLES[sev] ?? SEVERITY_STYLES.INFO;
                  return (
                    <div key={ins.id} style={{ padding: "8px 10px", borderRadius: 8, background: s.bg, border: `1px solid ${s.border}` }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: s.text }}>{s.icon} {ins.title}</p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>{ins.summary}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bank Health */}
      {accounts.length > 0 && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Bank Health Scores</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {accounts.map(a => {
              const score = a.healthScore ?? 0;
              const c = healthColor(score);
              return (
                <div key={a.id} style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-hover)" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{a.bankName}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                    <span style={{ fontSize: 26, fontWeight: 700, color: c }}>{score}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/100</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: "var(--border)", marginBottom: 6 }}>
                    <div style={{ height: 4, borderRadius: 4, background: c, width: `${score}%` }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: c }}>{healthLabel(score)}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                      <Clock size={9} />{formatTimeAgo(a.lastSyncAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

function GitMergeIcon(props: React.SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number; color?: string }) {
  const { size = 24, strokeWidth = 2, color = "currentColor", ...rest } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  );
}
