"use client";

import { motion } from "framer-motion";
import {
  DollarSign,
  Users,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Plus,
  ArrowRight,
  Clock,
  Package,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import RevenueChart from "@/components/RevenueChart";
import { useDashboard } from "@/hooks/useDashboard";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  PAID: "bg-emerald-500/20 text-emerald-400",
  SENT: "bg-blue-500/20 text-blue-400",
  OVERDUE: "bg-red-500/20 text-red-400",
  DRAFT: "bg-zinc-500/20 text-zinc-400",
  PENDING: "bg-amber-500/20 text-amber-400",
  IN_PROGRESS: "bg-blue-500/20 text-blue-400",
  COMPLETED: "bg-emerald-500/20 text-emerald-400",
};

const quickActions = [
  { label: "New Invoice", href: "/billing/new", icon: FileText, color: "#6366f1" },
  { label: "Add Customer", href: "/crm", icon: Users, color: "#10b981" },
  { label: "Manage Items", href: "/items", icon: Package, color: "#3b82f6" },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck, color: "#f59e0b" },
];

// ─── Loading skeleton ─────────────────────────────────────────
function Skeleton({ width = "100%", height = 20 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: "var(--bg-elevated)",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

export default function DashboardPage() {
  const {
    stats,
    recentInvoices,
    complianceTasks,
    lowStockItems,
    monthlyRevenue,
    loading,
    error,
    refetch,
  } = useDashboard();

  // Build stat cards from live data
  const statCards = [
    {
      title: "Total Revenue",
      value: loading ? "—" : `$${stats.totalRevenue.toLocaleString()}`,
      change: stats.revenueGrowth,
      changeLabel: "vs last month",
      icon: DollarSign,
      iconColor: "#6366f1",
    },
    {
      title: "Active Customers",
      value: loading ? "—" : String(stats.activeCustomers),
      change: 0,
      changeLabel: "in your org",
      icon: Users,
      iconColor: "#10b981",
    },
    {
      title: "Invoices Sent",
      value: loading ? "—" : String(stats.invoicesSentThisMonth),
      change: 0,
      changeLabel: "this month",
      icon: FileText,
      iconColor: "#3b82f6",
    },
    {
      title: "Overdue",
      value: loading ? "—" : String(stats.overdueInvoices),
      change: 0,
      changeLabel: "unpaid invoices",
      icon: AlertTriangle,
      iconColor: "#f59e0b",
    },
  ];

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            Good morning 👋
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <button
          onClick={refetch}
          className="btn-ghost"
          style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          title="Refresh dashboard"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Error state */}
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

      {/* Stats Grid */}
      <div
        className="stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {statCards.map((stat, i) => (
          <StatCard key={stat.title} {...stat} index={i} />
        ))}
      </div>

      {/* Main content grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Revenue Chart — pass live monthlyRevenue data */}
        <RevenueChart data={monthlyRevenue} loading={loading} />

        {/* Quick Actions */}
        <motion.div
          className="surface"
          style={{ padding: 20 }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <h3 className="section-title" style={{ marginBottom: 16 }}>
            Quick Actions
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: "var(--text-secondary)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-strong)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: `${action.color}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={15} color={action.color} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{action.label}</span>
                  <ArrowRight size={14} style={{ marginLeft: "auto", opacity: 0.5 }} />
                </Link>
              );
            })}
          </div>

          {/* Low stock alert */}
          {!loading && lowStockItems.length > 0 && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 12px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 10,
              }}
            >
              <p style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, marginBottom: 4 }}>
                ⚠ {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} low on stock
              </p>
              {lowStockItems.slice(0, 3).map((item) => (
                <p key={item.id} style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {item.name} — {item.stock}/{item.lowStockAt} left
                </p>
              ))}
              <Link href="/items" style={{ fontSize: 11, color: "#818cf8", textDecoration: "none" }}>
                View all →
              </Link>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 20,
        }}
      >
        {/* Recent Invoices */}
        <motion.div
          className="surface"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
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
            <Link
              href="/billing"
              style={{
                fontSize: 12,
                color: "#818cf8",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} height={32} />)}
            </div>
          ) : recentInvoices.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No invoices yet.{" "}
              <Link href="/billing/new" style={{ color: "#818cf8" }}>Create one →</Link>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} style={{ cursor: "pointer" }}>
                    <td style={{ fontFamily: "monospace", color: "var(--text-primary)", fontSize: 13 }}>
                      {inv.invoiceNumber}
                    </td>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {inv.customer?.name ?? "—"}
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      ${Number(inv.total).toLocaleString()}
                    </td>
                    <td>
                      <span
                        className={`badge ${statusColors[inv.status] || ""}`}
                        style={{ border: "none", fontSize: 10 }}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {format(new Date(inv.issueDate), "MMM d")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>

        {/* Compliance Tasks */}
        <motion.div
          className="surface"
          style={{ padding: 0, overflow: "hidden" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 20px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h3 className="section-title">Compliance</h3>
            <Link
              href="/compliance"
              style={{
                fontSize: 12,
                color: "#818cf8",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} height={56} />)
            ) : complianceTasks.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>
                No upcoming tasks.
              </p>
            ) : (
              complianceTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: "12px 14px",
                    background: "var(--bg-elevated)",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background:
                        task.status === "IN_PROGRESS"
                          ? "rgba(59,130,246,0.15)"
                          : "rgba(245,158,11,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {task.status === "IN_PROGRESS" ? (
                      <Clock size={13} color="#3b82f6" />
                    ) : (
                      <ShieldCheck size={13} color="#f59e0b" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                      {task.title}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      Due {format(new Date(task.dueDate), "MMM d")}
                    </p>
                  </div>
                  <span
                    className={`badge ${statusColors[task.status] || ""}`}
                    style={{ border: "none", fontSize: 10 }}
                  >
                    {task.status.replace("_", " ")}
                  </span>
                </div>
              ))
            )}

            <Link
              href="/compliance"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px dashed var(--border)",
                color: "var(--text-muted)",
                fontSize: 13,
                textDecoration: "none",
                marginTop: 4,
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={14} />
              Add compliance task
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
