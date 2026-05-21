"use client";

import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, TrendingDown, ArrowRight, RefreshCw,
  AlertTriangle, AlertCircle, Package, Clock, Sparkles,
  BarChart3, Briefcase, Activity, Users, Database,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import { useERP } from "@/hooks/useERP";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import type { ERPAlert, ERPSuggestion } from "@/types/erp";

const alertIcons: Record<string, React.ElementType> = {
  Package, TrendingDown, AlertTriangle, AlertCircle, Clock,
};
const impactColors: Record<string, string> = {
  high: "bg-red-500/15 text-red-400 border-red-500/25",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
};
const alertTypeColors: Record<string, string> = {
  danger: "border-l-red-500 bg-red-500/5",
  warning: "border-l-amber-500 bg-amber-500/5",
  info: "border-l-blue-500 bg-blue-500/5",
};
const statusColors: Record<string, string> = {
  COMPLETED: "bg-emerald-500/20 text-emerald-400",
  PENDING: "bg-amber-500/20 text-amber-400",
  CANCELLED: "bg-zinc-500/20 text-zinc-400",
};

function Skeleton({ width = "100%", height = 20 }: { width?: string | number; height?: number }) {
  return (
    <div style={{ width, height, borderRadius: 6, background: "var(--bg-elevated)", animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

function ProgressBar({ value, color = "#10b981" }: { value: number; color?: string }) {
  return (
    <div style={{ width: "100%", height: 6, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{ height: "100%", background: color, borderRadius: 99 }}
      />
    </div>
  );
}

export default function ErpPage() {
  const { metrics, operations, alerts, suggestions, projects, loading, error, refetch } = useERP();
  const { isMobile, isTablet } = useBreakpoint();

  const fmt = (n: number) =>
    `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const cols2 = isMobile ? "1fr" : "1fr 1fr";
  const cols4 = isMobile ? "repeat(2, 1fr)" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)";

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 12 : 0 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            ERP Command Center
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            Real-time financial metrics and intelligent business insights.
          </p>
        </div>
        <button onClick={refetch} className="btn-ghost" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, alignSelf: isMobile ? "flex-start" : "auto" }}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} />
          {error} — <button onClick={refetch} style={{ color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* Top Metrics */}
      <div className="stagger" style={{ display: "grid", gridTemplateColumns: cols4, gap: 14, marginBottom: 24 }}>
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton height={14} width="60%" />
              <div style={{ height: 8 }} />
              <Skeleton height={28} width="40%" />
            </div>
          ))
        ) : (
          <>
            <StatCard title="Revenue (MTD)" value={fmt(metrics.revenueMTD)} change={metrics.revenueGrowth} changeLabel="vs last month" icon={DollarSign} iconColor="#10b981" index={0} />
            <StatCard title="Profit Margin" value={`${metrics.profitMargin}%`} change={metrics.profitMargin >= 20 ? metrics.profitMargin - 20 : -(20 - metrics.profitMargin)} changeLabel={metrics.profitMargin >= 20 ? "above target" : "below target"} icon={TrendingUp} iconColor={metrics.profitMargin >= 20 ? "#10b981" : "#ef4444"} index={1} />
            <StatCard title="Cash Flow" value={`${metrics.cashFlow >= 0 ? "" : "-"}${fmt(metrics.cashFlow)}`} icon={BarChart3} iconColor={metrics.cashFlow >= 0 ? "#3b82f6" : "#ef4444"} index={2} />
            <StatCard title="Working Capital" value={`${metrics.workingCapitalRatio}x`} change={metrics.workingCapitalRatio >= 1.5 ? 0 : -1} changeLabel={metrics.workingCapitalRatio >= 1.5 ? "healthy" : "needs attention"} icon={Activity} iconColor="#8b5cf6" index={3} />
          </>
        )}
      </div>

      {/* Operations */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} style={{ marginBottom: 24 }}>
        <h3 className="section-title" style={{ marginBottom: 14, fontSize: 16 }}>Operations</h3>
        <div style={{ display: "grid", gridTemplateColumns: cols4, gap: 14 }}>
          <div className="stat-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Billable Hours</p>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Clock size={14} color="#3b82f6" />
              </div>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{loading ? "—" : `${operations.billableHours}h`}</p>
          </div>

          <div className="stat-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>SLA Adherence</p>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Briefcase size={14} color="#10b981" />
              </div>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 8 }}>{loading ? "—" : `${operations.slaAdherence}%`}</p>
            <ProgressBar value={operations.slaAdherence} color="#10b981" />
          </div>

          <div className="stat-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Project Overrun</p>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: operations.projectOverrun > 20 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)", border: `1px solid ${operations.projectOverrun > 20 ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={14} color={operations.projectOverrun > 20 ? "#ef4444" : "#f59e0b"} />
              </div>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{loading ? "—" : `${operations.projectOverrun}%`}</p>
          </div>

          <div className="stat-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Resources</p>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={14} color="#8b5cf6" />
              </div>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 8 }}>{loading ? "—" : `${operations.resourceAllocation}%`}</p>
            <ProgressBar value={operations.resourceAllocation} color={operations.resourceAllocation > 50 ? "#10b981" : "#ef4444"} />
          </div>
        </div>
      </motion.div>

      {/* Active Projects Table */}
      <motion.div className="surface" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }} style={{ marginBottom: 24, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <h3 className="section-title">Active Projects</h3>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{projects.length} total</span>
        </div>
        {loading ? (
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} height={36} />)}
          </div>
        ) : projects.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No projects found. Create a sale to see projects here.
          </div>
        ) : isMobile ? (
          /* Mobile: card list */
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {projects.map((project) => (
              <div key={project.id} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{project.name}</p>
                  <span className={`badge ${statusColors[project.status] || ""}`} style={{ border: "none", fontSize: 10 }}>{project.status}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>{project.client} · {fmt(project.amount)}</p>
                <ProgressBar value={project.progress} color={project.progress === 100 ? "#10b981" : "#6366f1"} />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, textAlign: "right" }}>{project.progress}%</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 500 }}>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  {!isTablet && <th>Amount</th>}
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: 13 }}>{project.name}</td>
                    <td style={{ fontSize: 13 }}>{project.client}</td>
                    {!isTablet && <td style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>{fmt(project.amount)}</td>}
                    <td style={{ width: 120 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ProgressBar value={project.progress} color={project.progress === 100 ? "#10b981" : "#6366f1"} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{project.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${statusColors[project.status] || ""}`} style={{ border: "none", fontSize: 10 }}>{project.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Alerts + AI Suggestions */}
      <div style={{ display: "grid", gridTemplateColumns: cols2, gap: 20, marginBottom: 24 }}>
        {/* Alerts */}
        <motion.div className="surface" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 }} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={16} color="#f59e0b" />
              <h3 className="section-title">Key Alerts</h3>
            </div>
            <span className="badge" style={{ background: alerts.length > 0 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)", color: alerts.length > 0 ? "#ef4444" : "#10b981", border: "none", fontSize: 10 }}>
              {alerts.length > 0 ? `${alerts.length} ACTIVE` : "ALL CLEAR"}
            </span>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} height={52} />)
            ) : alerts.length === 0 ? (
              <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                  <Sparkles size={18} color="#10b981" />
                </div>
                All systems healthy — no alerts.
              </div>
            ) : (
              alerts.map((alert: ERPAlert) => {
                const Icon = alertIcons[alert.icon] || AlertTriangle;
                return (
                  <div key={alert.id} style={{ padding: "12px 14px", borderRadius: 10, borderLeft: "3px solid", display: "flex", alignItems: "flex-start", gap: 12 }} className={alertTypeColors[alert.type] || ""}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: alert.type === "danger" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <Icon size={13} color={alert.type === "danger" ? "#ef4444" : "#f59e0b"} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{alert.title}</p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{alert.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* AI Suggestions */}
        <motion.div className="surface" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.55 }} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color="#8b5cf6" />
              <h3 className="section-title" style={{ fontSize: isMobile ? 14 : 18 }}>AI CFO Suggestions</h3>
            </div>
            <span className="badge" style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6", border: "none", fontSize: 10 }}>AI POWERED</span>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} height={64} />)
            ) : suggestions.length === 0 ? (
              <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No suggestions at this time.</div>
            ) : (
              suggestions.map((s: ERPSuggestion) => (
                <div key={s.id} style={{ padding: "14px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", transition: "all 0.15s ease" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>{s.title}</p>
                    <span className={`badge ${impactColors[s.impact] || ""}`} style={{ border: "none", fontSize: 9, marginLeft: 8 }}>{s.impact.toUpperCase()}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{s.description}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 500 }}>{s.category}</span>
                    <ArrowRight size={10} color="#818cf8" />
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Financial Breakdown */}
      <motion.div className="surface" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.6 }} style={{ padding: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 16 }}>Financial Breakdown</h3>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : isTablet ? "repeat(3, 1fr)" : "repeat(5, 1fr)", gap: 12 }}>
          {[
            { label: "Total Sales", value: fmt(metrics.totalSales), color: "#10b981", icon: TrendingUp },
            { label: "Purchases", value: fmt(metrics.totalPurchases), color: "#3b82f6", icon: Package },
            { label: "Expenses", value: fmt(metrics.totalExpenses), color: "#f59e0b", icon: AlertCircle },
            { label: "Payroll", value: fmt(metrics.totalPayroll), color: "#8b5cf6", icon: Users },
            { label: "Inventory", value: fmt(metrics.inventoryValue), color: "#06b6d4", icon: Database },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} style={{ padding: "14px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Icon size={13} color={item.color} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.label}</span>
                </div>
                <p style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  {loading ? "—" : item.value}
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
