"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet, BookText, Scale, Landmark, BookOpen, PiggyBank,
  CheckCircle2, AlertTriangle, ArrowUpRight, TrendingUp, TrendingDown,
} from "lucide-react";
import { useQuery } from "@/lib/queryCache";
import { formatCurrency } from "@/lib/formatters/currency";
import { useBreakpoint } from "@/hooks/useBreakpoint";

type DashboardSummary = {
  accounts: { active: number; inactive: number; total: number };
  assets: number;
  liabilities: number;
  equity: number;
  income: number;
  expense: number;
  netIncome: number;
  equationDelta: number;
};

async function fetchSummary(): Promise<DashboardSummary> {
  const res = await fetch("/api/accounting/dashboard");
  if (!res.ok) throw new Error("Failed to load accounting summary");
  return res.json();
}

export default function AccountingOverviewPage() {
  const { isMobile } = useBreakpoint();
  const { data, isLoading } = useQuery<DashboardSummary>(
    ["accounting", "dashboard"],
    fetchSummary,
    { staleTime: 30_000 }
  );

  const money = (n: number | undefined) => (data ? formatCurrency(n ?? 0) : "—");
  const balanced = data ? Math.abs(data.equationDelta) < 0.01 : true;

  const kpis = [
    { label: "Total Assets",      value: money(data?.assets),      color: "#10b981", icon: Wallet },
    { label: "Total Liabilities", value: money(data?.liabilities), color: "#f59e0b", icon: Scale },
    { label: "Total Equity",      value: money(data?.equity),      color: "#818cf8", icon: Landmark },
    {
      label: "Net Income",
      value: money(data?.netIncome),
      color: (data?.netIncome ?? 0) >= 0 ? "#10b981" : "#ef4444",
      icon: (data?.netIncome ?? 0) >= 0 ? TrendingUp : TrendingDown,
    },
  ];

  const quickLinks = [
    { label: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: Wallet,    desc: `${data?.accounts.active ?? "—"} active accounts` },
    { label: "Manual Journals",   href: "/accounting/journals",          icon: BookText,  desc: "Post double-entry journals" },
    { label: "General Ledger",    href: "/accounting/general-ledger",    icon: BookOpen,  desc: "Account-wise transactions" },
    { label: "Trial Balance",     href: "/accounting/trial-balance",     icon: Scale,     desc: "Debit / credit totals" },
    { label: "Balance Sheet",     href: "/accounting/balance-sheet",     icon: Landmark,  desc: "Financial position" },
    { label: "Budgets",           href: "/accounting/budgets",           icon: PiggyBank, desc: "Plan vs actual" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Accounting Overview
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
          Your organization&apos;s books at a glance — balances, equity and the accounting equation.
        </p>
      </div>

      {/* Accounting-equation banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="surface"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          marginBottom: 24,
          border: `1px solid ${balanced ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.35)"}`,
          background: balanced ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)",
        }}
      >
        {balanced ? <CheckCircle2 size={18} color="#10b981" /> : <AlertTriangle size={18} color="#f59e0b" />}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {balanced ? "Books are balanced" : "Books are out of balance"}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
            Assets {money(data?.assets)} = Liabilities {money(data?.liabilities)} + Equity {money(data?.equity)} + Net Income {money(data?.netIncome)}
            {!balanced && data ? ` · difference ${formatCurrency(data.equationDelta)}` : ""}
          </p>
        </div>
      </motion.div>

      {/* KPI cards */}
      <div
        className="stagger"
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              className="stat-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{ padding: isMobile ? "14px 16px" : "20px 22px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {kpi.label}
                </p>
                <Icon size={15} color={kpi.color} />
              </div>
              <p style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: kpi.color, marginTop: 8 }}>
                {isLoading ? "…" : kpi.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Income / expense strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {[
          { label: "Income (YTD)",  value: money(data?.income),  color: "#10b981" },
          { label: "Expenses (YTD)", value: money(data?.expense), color: "#ef4444" },
          { label: "Accounts", value: isLoading ? "…" : `${data?.accounts.active ?? 0} active / ${data?.accounts.total ?? 0} total`, color: "#818cf8" },
        ].map((s) => (
          <div key={s.label} className="surface" style={{ padding: "16px 18px" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: s.color, marginTop: 6 }}>{isLoading ? "…" : s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <h3 className="section-title" style={{ fontSize: 14, marginBottom: 12, color: "var(--text-secondary)" }}>Modules</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="surface" style={{
              display: "flex", alignItems: "center", gap: 12, padding: "16px 18px",
              textDecoration: "none", transition: "border-color 0.15s",
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={17} color="var(--brand-400)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{link.label}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{link.desc}</p>
              </div>
              <ArrowUpRight size={15} color="var(--text-muted)" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
