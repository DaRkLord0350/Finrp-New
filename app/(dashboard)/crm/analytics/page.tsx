"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, AlertCircle, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface CustomerAnalytics {
  revenue: {
    total: number;
    last30Days: number;
    last90Days: number;
    last365Days: number;
    average: number;
  };
  transactions: {
    total: number;
    last30Days: number;
    avgFrequencyMonthly: number;
  };
  outstanding: {
    amount: number;
    overdueAmount: number;
    overdueInvoices: number;
  };
  payment: {
    rate: number;
    paidInvoices: number;
    pendingInvoices: number;
  };
  credit: {
    limit: number;
    utilized: number;
    utilizationRate: number;
    available: number;
  };
  lifecycle: {
    customerScore: number;
    daysSinceLastPurchase: number | null;
    customerLifetimeValue: number;
    retentionRate: number;
    accountAge: number;
  };
  monthlyTrend: Record<string, number>;
  status: {
    isActive: boolean;
    lastPurchaseDate: string;
    accountCreatedDate: string;
  };
}

interface KPICard {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: string;
  color: string;
}

export default function CRMAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Record<string, CustomerAnalytics>>({});
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [overdueCustomers, setOverdueCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch top customers and overdue customers in parallel
      const [topRes, overdueRes] = await Promise.all([
        fetch("/api/customers/top"),
        fetch("/api/customers/overdue"),
      ]);

      if (!topRes.ok || !overdueRes.ok) throw new Error("Failed to fetch analytics");

      const topData = await topRes.json();
      const overdueData = await overdueRes.json();

      setTopCustomers(topData.slice(0, 10));
      setOverdueCustomers(overdueData.slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const KPICard = ({ icon, label, value, change, color }: KPICard) => (
    <motion.div
      className="surface"
      style={{ padding: 20 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${color}15`,
            border: `1px solid ${color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
          }}
        >
          {icon}
        </div>
        {change && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: change.startsWith("+") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              color: change.startsWith("+") ? "#10b981" : "#ef4444",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            {change}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{value}</p>
    </motion.div>
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <div style={{ animation: "pulse 1s ease-in-out infinite", color: "var(--text-muted)" }}>
          Loading analytics…
        </div>
      </div>
    );
  }

  // Aggregate metrics
  const totalCustomers = topCustomers.length + (overdueCustomers.length > 0 ? 1 : 0);
  const totalRevenue = topCustomers.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalOutstanding = topCustomers.reduce((sum, c) => sum + (c.outstandingRevenue || 0), 0);
  const avgCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  // Chart data
  const revenueChartData = [
    { name: "Top 1", revenue: topCustomers[0]?.totalRevenue || 0 },
    { name: "Top 2", revenue: topCustomers[1]?.totalRevenue || 0 },
    { name: "Top 3", revenue: topCustomers[2]?.totalRevenue || 0 },
    { name: "Top 4", revenue: topCustomers[3]?.totalRevenue || 0 },
    { name: "Top 5", revenue: topCustomers[4]?.totalRevenue || 0 },
  ].filter((d) => d.revenue > 0);

  const overdueChartData = overdueCustomers.slice(0, 10).map((c) => ({
    name: c.name,
    overdue: c.totalOverdue,
    days: c.dayOverdue,
  }));

  const paymentStatusData = [
    { name: "Paid", value: topCustomers.reduce((s, c) => s + c.invoiceCount * 0.7, 0) },
    { name: "Pending", value: topCustomers.reduce((s, c) => s + c.invoiceCount * 0.3, 0) },
  ];

  const COLORS = ["#10b981", "#f59e0b"];

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          Customer Analytics
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
          Track customer trends, revenue insights, and payment patterns
        </p>
      </motion.div>

      {/* Key Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <KPICard
          icon={<Users size={20} />}
          label="Total Customers"
          value={totalCustomers}
          color="#6366f1"
        />
        <KPICard
          icon={<TrendingUp size={20} />}
          label="Total Revenue"
          value={`$${(totalRevenue / 1000).toFixed(1)}k`}
          color="#10b981"
        />
        <KPICard
          icon={<AlertCircle size={20} />}
          label="Outstanding Amount"
          value={`$${(totalOutstanding / 1000).toFixed(1)}k`}
          color="#f59e0b"
        />
        <KPICard
          icon={<BarChart3 size={20} />}
          label="Average Customer Value"
          value={`$${(avgCustomerValue / 1000).toFixed(1)}k`}
          color="#3b82f6"
        />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Top Customers Revenue */}
        <motion.div
          className="surface"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Top Customers by Revenue
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                }}
              />
              <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Payment Status Pie */}
        <motion.div
          className="surface"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Payment Status Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${Math.round(value)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentStatusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Top Customers Table */}
      <motion.div
        className="surface"
        style={{ padding: 24, marginBottom: 32 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
          Top 10 Customers
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                  Customer Name
                </th>
                <th style={{ textAlign: "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                  Total Revenue
                </th>
                <th style={{ textAlign: "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                  Outstanding
                </th>
                <th style={{ textAlign: "center", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                  Invoices
                </th>
                <th style={{ textAlign: "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((customer, idx) => (
                <tr key={customer.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: 12, color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                    {idx + 1}. {customer.name}
                  </td>
                  <td style={{ padding: 12, textAlign: "right", color: "#10b981", fontSize: 13, fontWeight: 600 }}>
                    ${(customer.totalRevenue / 1000).toFixed(1)}k
                  </td>
                  <td style={{ padding: 12, textAlign: "right", color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>
                    ${((customer.outstandingRevenue || 0) / 1000).toFixed(1)}k
                  </td>
                  <td style={{ padding: 12, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                    {customer.invoiceCount}
                  </td>
                  <td style={{ padding: 12, textAlign: "right", color: "var(--text-secondary)", fontSize: 12 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 8px",
                        borderRadius: 4,
                        background: "rgba(99,102,241,0.1)",
                        color: "#6366f1",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {customer.customerType}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Overdue Customers Alert */}
      {overdueCustomers.length > 0 && (
        <motion.div
          className="surface"
          style={{ padding: 24, borderLeft: "4px solid #ef4444" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <AlertCircle size={20} color="#ef4444" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>
              Overdue Payments ({overdueCustomers.length})
            </h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                    Customer
                  </th>
                  <th style={{ textAlign: "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                    Overdue Amount
                  </th>
                  <th style={{ textAlign: "center", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                    Invoices
                  </th>
                  <th style={{ textAlign: "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>
                    Days Overdue
                  </th>
                </tr>
              </thead>
              <tbody>
                {overdueCustomers.map((customer) => (
                  <tr key={customer.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: 12, color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                      {customer.name}
                    </td>
                    <td style={{ padding: 12, textAlign: "right", color: "#ef4444", fontSize: 13, fontWeight: 600 }}>
                      ${(customer.totalOverdue / 1000).toFixed(1)}k
                    </td>
                    <td style={{ padding: 12, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                      {customer.overdueInvoiceCount}
                    </td>
                    <td style={{ padding: 12, textAlign: "right", color: "#ef4444", fontSize: 13, fontWeight: 600 }}>
                      {customer.dayOverdue} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
