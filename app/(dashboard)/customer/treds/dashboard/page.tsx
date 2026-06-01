"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Landmark,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wallet,
  RefreshCw,
  ArrowRight,
  Lightbulb,
  AlertTriangle,
  Info,
  Plus,
  Zap,
} from "lucide-react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import { useTredsDashboard } from "@/hooks/useTredsDashboard";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ── Status helpers ────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  DRAFT:          "bg-zinc-500/20 text-zinc-400",
  READY:          "bg-blue-500/20 text-blue-400",
  SUBMITTED:      "bg-indigo-500/20 text-indigo-400",
  BUYER_APPROVED: "bg-cyan-500/20 text-cyan-400",
  UNDER_BIDDING:  "bg-amber-500/20 text-amber-400",
  DISCOUNTED:     "bg-emerald-500/20 text-emerald-400",
  SETTLED:        "bg-green-500/20 text-green-400",
  REJECTED:       "bg-red-500/20 text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT:          "Draft",
  READY:          "Ready",
  SUBMITTED:      "Submitted",
  BUYER_APPROVED: "Buyer Approved",
  UNDER_BIDDING:  "Under Bidding",
  DISCOUNTED:     "Discounted",
  SETTLED:        "Settled",
  REJECTED:       "Rejected",
};

const FINANCIER_PALETTE = ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"];

// ── Skeleton ─────────────────────────────────────────────────
function Skeleton({ height = 20, width = "100%" }: { height?: number; width?: string | number }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: 6,
        background: "var(--bg-elevated)",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

// ── Custom Tooltip ────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "var(--shadow-md)",
        minWidth: 120,
      }}
    >
      <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color ?? "var(--text-primary)" }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          ₹{Number(p.value).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
}

// ── Insight type icon ─────────────────────────────────────────
function InsightIcon({ type }: { type: string }) {
  if (type === "warning") return <AlertTriangle size={14} color="#f59e0b" />;
  if (type === "opportunity") return <Zap size={14} color="#6366f1" />;
  return <Info size={14} color="#3b82f6" />;
}

// ── Page ──────────────────────────────────────────────────────
export default function TredsDashboardPage() {
  const {
    stats,
    monthlyFunding,
    fundingByFinancier,
    recentInvoices,
    aiInsights,
    integration,
    loading,
    error,
    refetch,
  } = useTredsDashboard();

  const statCards = [
    {
      title: "Total Eligible",
      value: loading ? "—" : String(stats.totalEligible),
      change: 0,
      changeLabel: "ready for TReDS",
      icon: FileText,
      iconColor: "#6366f1",
    },
    {
      title: "Submitted",
      value: loading ? "—" : String(stats.submitted),
      change: 0,
      changeLabel: "on M1xchange",
      icon: TrendingUp,
      iconColor: "#3b82f6",
    },
    {
      title: "Discounted",
      value: loading ? "—" : String(stats.discounted),
      change: 0,
      changeLabel: "funded invoices",
      icon: CheckCircle2,
      iconColor: "#10b981",
    },
    {
      title: "Pending Approval",
      value: loading ? "—" : String(stats.pendingApproval),
      change: 0,
      changeLabel: "awaiting buyer",
      icon: Clock,
      iconColor: "#f59e0b",
    },
    {
      title: "Funds Received",
      value: loading ? "—" : `₹${(stats.fundsReceived / 100000).toFixed(1)}L`,
      change: 0,
      changeLabel: "total disbursed",
      icon: Wallet,
      iconColor: "#10b981",
    },
    {
      title: "Avg. Rate",
      value: loading ? "—" : stats.avgFinancingRate > 0 ? `${stats.avgFinancingRate.toFixed(2)}%` : "—",
      change: 0,
      changeLabel: "financing rate p.a.",
      icon: Landmark,
      iconColor: "#8b5cf6",
    },
  ];

  return (
    <div>
      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Landmark size={16} color="#818cf8" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              TReDS Dashboard
            </h1>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                background: "rgba(16,185,129,0.15)",
                color: "#10b981",
                padding: "3px 8px",
                borderRadius: 6,
                border: "1px solid rgba(16,185,129,0.3)",
                letterSpacing: "0.06em",
              }}
            >
              M1XCHANGE
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Monitor your invoice discounting performance and funding pipeline.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={refetch} className="btn-ghost" style={{ padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <RefreshCw size={13} />
            Refresh
          </button>
          <Link href="/customer/treds/invoices" className="btn-brand" style={{ padding: "7px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
            <Plus size={13} />
            Submit Invoice
          </Link>
        </div>
      </div>

      {/* ── Integration Status Banner ─────────────────── */}
      {!loading && !integration && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <AlertCircle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>M1xchange not connected</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Connect your M1xchange account to start discounting invoices.
            </p>
          </div>
          <Link
            href="/customer/treds/integration"
            style={{ fontSize: 12, color: "#f59e0b", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
          >
            Connect now <ArrowRight size={12} />
          </Link>
        </motion.div>
      )}

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10,
            padding: "12px 16px",
            color: "#ef4444",
            fontSize: 13,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={14} />
          {error} —{" "}
          <button onClick={refetch} style={{ color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}

      {/* ── KPI Grid ─────────────────────────────────── */}
      <div
        className="stagger"
        style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 24 }}
      >
        {statCards.map((s, i) => (
          <StatCard key={s.title} {...s} index={i} />
        ))}
      </div>

      {/* ── Charts Row ───────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, marginBottom: 24 }}>
        {/* Financing Trend */}
        <motion.div
          className="chart-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 className="section-title">Invoice Financing Trend</h3>
            <p className="section-subtitle">Monthly submitted, approved and funded invoices</p>
          </div>
          {loading ? (
            <Skeleton height={220} />
          ) : monthlyFunding.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 0" }}>
              <TrendingUp size={32} color="var(--text-muted)" />
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No financing data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyFunding} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSubmitted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFunded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#6366f1" strokeWidth={2} fill="url(#gSubmitted)" />
                <Area type="monotone" dataKey="approved" name="Approved" stroke="#3b82f6" strokeWidth={2} fill="url(#gApproved)" />
                <Area type="monotone" dataKey="funded" name="Funded" stroke="#10b981" strokeWidth={2} fill="url(#gFunded)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Funding by Financier */}
        <motion.div
          className="chart-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3 }}
        >
          <div style={{ marginBottom: 16 }}>
            <h3 className="section-title">Funding Sources</h3>
            <p className="section-subtitle">By financier institution</p>
          </div>
          {loading ? (
            <Skeleton height={220} />
          ) : fundingByFinancier.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 0" }}>
              <Landmark size={32} color="var(--text-muted)" />
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No funding data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={fundingByFinancier}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  paddingAngle={3}
                >
                  {fundingByFinancier.map((_, i) => (
                    <Cell key={i} fill={FINANCIER_PALETTE[i % FINANCIER_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CurrencyTooltip />} />
                <Legend
                  formatter={(v) => <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* ── Bottom Row ───────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* Recent Invoices */}
        <motion.div
          className="surface"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.35 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h3 className="section-title">Recent Invoices</h3>
            <Link href="/customer/treds/invoices" style={{ fontSize: 12, color: "#818cf8", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(5)].map((_, i) => <Skeleton key={i} height={30} />)}
            </div>
          ) : recentInvoices.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <FileText size={36} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No invoices submitted yet.</p>
              <Link href="/customer/treds/invoices" style={{ fontSize: 13, color: "#818cf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                Submit your first invoice <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Buyer</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Financier</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/customer/treds/invoices/${inv.id}`} style={{ color: "#818cf8", textDecoration: "none", fontFamily: "monospace", fontSize: 13 }}>
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{inv.buyerName}</td>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        ₹{Number(inv.invoiceAmount).toLocaleString("en-IN")}
                      </td>
                      <td style={{ fontSize: 12 }}>{format(new Date(inv.dueDate), "dd MMM yyyy")}</td>
                      <td>
                        <span className={`badge ${STATUS_COLORS[inv.status] ?? ""}`} style={{ border: "none", fontSize: 10 }}>
                          {STATUS_LABELS[inv.status] ?? inv.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{inv.financierName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* AI Insights */}
        <motion.div
          className="surface"
          style={{ padding: 0, overflow: "hidden" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.4 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "20px 20px 14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: "rgba(99,102,241,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Lightbulb size={13} color="#818cf8" />
            </div>
            <h3 className="section-title" style={{ fontSize: 15 }}>AI Insights</h3>
          </div>

          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} height={64} />)
            ) : aiInsights.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0", textAlign: "center" }}>
                Submit invoices to unlock insights.
              </p>
            ) : (
              aiInsights.map((insight, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px 14px",
                    background: "var(--bg-elevated)",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background:
                        insight.type === "warning"
                          ? "rgba(245,158,11,0.12)"
                          : insight.type === "opportunity"
                          ? "rgba(99,102,241,0.12)"
                          : "rgba(59,130,246,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <InsightIcon type={insight.type} />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                      {insight.title}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      {insight.description}
                    </p>
                  </div>
                </div>
              ))
            )}

            <Link
              href="/customer/treds/invoices"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px dashed var(--border)",
                color: "var(--text-muted)",
                fontSize: 12,
                textDecoration: "none",
                marginTop: 2,
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={13} />
              Submit new invoice to TReDS
            </Link>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
