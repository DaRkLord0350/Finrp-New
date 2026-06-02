"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { TrendingUp, DollarSign, Users, FileText, RefreshCw, ArrowRight } from "lucide-react";
import StatCard from "@/components/StatCard";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useBreakpoint } from "@/hooks/useBreakpoint";

const ChartPlaceholder = ({ height = 200 }: { height?: number }) => (
  <div style={{ height, background: "var(--bg-elevated)", borderRadius: 10, animation: "skeletonPulse 1.5s ease-in-out infinite" }} />
);

const DynamicRevenueTrend = dynamic(
  () => import("./FinanceCharts").then((m) => ({ default: m.RevenueTrendChart })),
  { loading: () => <ChartPlaceholder height={240} />, ssr: false }
);

const DynamicInvoiceStatus = dynamic(
  () => import("./FinanceCharts").then((m) => ({ default: m.InvoiceStatusChart })),
  { loading: () => <ChartPlaceholder height={180} />, ssr: false }
);

const DynamicNetProfit = dynamic(
  () => import("./FinanceCharts").then((m) => ({ default: m.NetProfitChart })),
  { loading: () => <ChartPlaceholder height={200} />, ssr: false }
);

export default function FinancePage() {
  const router = useRouter();
  const { isMobile, isTablet } = useBreakpoint();
  const {
    totalRevenue, revenueGrowth, totalInvoices, paidInvoices, overdueInvoices,
    totalCustomers, avgDealSize, monthlyRevenue, paymentMix, topCustomers,
    loading, error, refetch,
  } = useAnalytics() as ReturnType<typeof useAnalytics> & {
    paymentMix?: { name: string; value: number; color: string }[];
    topCustomers?: { name: string; revenue: number }[];
  };

  const netProfit = (monthlyRevenue ?? []).map((d) => ({ ...d, profit: d.revenue }));

  const displayPaymentMix = paymentMix ?? [
    { name: "Paid", value: 0, color: "#10b981" },
    { name: "Outstanding", value: 0, color: "#3b82f6" },
    { name: "Overdue", value: 0, color: "#ef4444" },
    { name: "Draft", value: 0, color: "#52525b" },
  ];

  const displayTopCustomers = topCustomers ?? [];
  const maxRevenue = displayTopCustomers[0]?.revenue || 1;

  const stats = [
    { title: "Total Revenue", value: loading ? "—" : `$${totalRevenue.toLocaleString()}`, change: revenueGrowth, changeLabel: "vs last month", icon: DollarSign, iconColor: "#6366f1" },
    { title: "Avg Deal Size", value: loading ? "—" : `$${avgDealSize.toLocaleString()}`, change: 0, changeLabel: "per paid invoice", icon: TrendingUp, iconColor: "#10b981" },
    { title: "Total Invoices", value: loading ? "—" : String(totalInvoices), change: 0, changeLabel: `${paidInvoices} paid`, icon: FileText, iconColor: "#3b82f6" },
    { title: "Customers", value: loading ? "—" : String(totalCustomers), change: 0, changeLabel: "active in org", icon: Users, iconColor: "#f59e0b" },
  ];

  const cols2 = isMobile ? "1fr" : "1fr 1fr";

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: isMobile ? 12 : 0 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Finance Analytics</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>Revenue performance, profitability metrics, and customer insights.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={refetch} style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            {!isMobile && "Refresh"}
          </button>
          <button
            onClick={() => router.push("/finance/loans")}
            style={{ padding: "8px 16px", background: "#6366f1", color: "#ffffff", border: "none", borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s ease" }}
          >
            {isMobile ? "Loans" : "Loans & Dashboard"}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 20 }}>
          {error} — <button onClick={refetch} style={{ color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {stats.map((stat, i) => <StatCard key={stat.title} {...stat} index={i} />)}
      </div>

      {/* Revenue Trend + Invoice Status */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr" : "2fr 1fr", gap: 20, marginBottom: 20 }}>
        <motion.div className="chart-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 className="section-title">Revenue Trend</h3>
            <p className="section-subtitle">Monthly revenue for the last 7 months</p>
          </div>
          {(monthlyRevenue?.length ?? 0) > 0 ? (
            <DynamicRevenueTrend data={netProfit} isMobile={isMobile} />
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>No invoice data yet</div>
          )}
        </motion.div>

        <motion.div className="chart-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 className="section-title">Invoice Status</h3>
            <p className="section-subtitle">Payment distribution</p>
          </div>
          <DynamicInvoiceStatus data={displayPaymentMix} isMobile={isMobile} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {displayPaymentMix.map((d) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{d.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Net Profit + Top Customers */}
      <div style={{ display: "grid", gridTemplateColumns: cols2, gap: 20 }}>
        <motion.div className="chart-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 className="section-title">Net Profit Trend</h3>
            <p className="section-subtitle">Monthly profitability</p>
          </div>
          {netProfit.length > 0 ? (
            <DynamicNetProfit data={netProfit} isMobile={isMobile} />
          ) : (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>No data yet</div>
          )}
        </motion.div>

        <motion.div className="chart-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 className="section-title">Top Customers</h3>
            <p className="section-subtitle">By total revenue contribution</p>
          </div>
          {displayTopCustomers.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No paid invoices yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {displayTopCustomers.map((c, i) => {
                const pct = (c.revenue / maxRevenue) * 100;
                return (
                  <div key={c.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                        {c.name.length === 36 ? `Customer ${i + 1}` : c.name}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>${c.revenue.toLocaleString()}</span>
                    </div>
                    <div style={{ height: 5, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                      <motion.div
                        style={{ height: "100%", borderRadius: 99, background: `hsl(${245 - i * 25}, 80%, 65%)` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.5 + i * 0.08, duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
      `}</style>
    </div>
  );
}
