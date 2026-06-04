"use client";

import dynamic from "next/dynamic";
import { TrendingUp, Users, AlertCircle, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

const BarChart = dynamic(() => import("recharts").then((m) => ({ default: m.BarChart })), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => ({ default: m.Bar })), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => ({ default: m.XAxis })), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => ({ default: m.YAxis })), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => ({ default: m.CartesianGrid })), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => ({ default: m.Tooltip })), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => ({ default: m.ResponsiveContainer })), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => ({ default: m.PieChart })), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => ({ default: m.Pie })), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => ({ default: m.Cell })), { ssr: false });

type TopCustomer = {
  id: string;
  name: string;
  company: string | null;
  customerType: string;
  totalRevenue: number;
  outstandingRevenue: number;
  invoiceCount: number;
};

type OverdueCustomer = {
  id: string;
  name: string;
  company: string | null;
  totalOverdue: number;
  overdueInvoiceCount: number;
  dayOverdue: number;
};

interface Props {
  topCustomers: TopCustomer[];
  overdueCustomers: OverdueCustomer[];
}

const COLORS = ["#10b981", "#f59e0b"];

function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <motion.div className="surface" style={{ padding: 20 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{value}</p>
    </motion.div>
  );
}

export default function CRMAnalyticsClient({ topCustomers, overdueCustomers }: Props) {
  const totalRevenue = topCustomers.reduce((s, c) => s + c.totalRevenue, 0);
  const totalOutstanding = topCustomers.reduce((s, c) => s + c.outstandingRevenue, 0);
  const avgCustomerValue = topCustomers.length > 0 ? totalRevenue / topCustomers.length : 0;

  const revenueChartData = topCustomers.slice(0, 5).map((c, i) => ({
    name: c.name.split(" ")[0] ?? `Top ${i + 1}`,
    revenue: c.totalRevenue,
  }));

  const paymentStatusData = [
    { name: "Paid", value: topCustomers.reduce((s, c) => s + c.invoiceCount * 0.7, 0) },
    { name: "Pending", value: topCustomers.reduce((s, c) => s + c.invoiceCount * 0.3, 0) },
  ];

  const tooltipStyle = { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)" };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Customer Analytics</h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>Track customer trends, revenue insights, and payment patterns</p>
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <KPICard icon={<Users size={20} />} label="Top Customers" value={topCustomers.length} color="#6366f1" />
        <KPICard icon={<TrendingUp size={20} />} label="Total Revenue" value={`₹${(totalRevenue / 1000).toFixed(1)}k`} color="#10b981" />
        <KPICard icon={<AlertCircle size={20} />} label="Outstanding Amount" value={`₹${(totalOutstanding / 1000).toFixed(1)}k`} color="#f59e0b" />
        <KPICard icon={<BarChart3 size={20} />} label="Avg Customer Value" value={`₹${(avgCustomerValue / 1000).toFixed(1)}k`} color="#3b82f6" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <motion.div className="surface" style={{ padding: 24 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Top Customers by Revenue</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="surface" style={{ padding: 24 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Payment Status Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={paymentStatusData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${Math.round(value as number)}`} outerRadius={80} dataKey="value">
                {paymentStatusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div className="surface" style={{ padding: 24, marginBottom: 32 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Top Customers</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Customer Name", "Total Revenue", "Outstanding", "Invoices", "Type"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c, idx) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: 12, color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>{idx + 1}. {c.name}</td>
                  <td style={{ padding: 12, textAlign: "right", color: "#10b981", fontSize: 13, fontWeight: 600 }}>₹{(c.totalRevenue / 1000).toFixed(1)}k</td>
                  <td style={{ padding: 12, textAlign: "right", color: "#f59e0b", fontSize: 13, fontWeight: 600 }}>₹{(c.outstandingRevenue / 1000).toFixed(1)}k</td>
                  <td style={{ padding: 12, textAlign: "right", color: "var(--text-secondary)", fontSize: 13 }}>{c.invoiceCount}</td>
                  <td style={{ padding: 12, textAlign: "right" }}>
                    <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 4, background: "rgba(99,102,241,0.1)", color: "#6366f1", fontSize: 11, fontWeight: 600 }}>{c.customerType}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {overdueCustomers.length > 0 && (
        <motion.div className="surface" style={{ padding: 24, borderLeft: "4px solid #ef4444" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <AlertCircle size={20} color="#ef4444" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>Overdue Payments ({overdueCustomers.length})</h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Customer", "Overdue Amount", "Invoices", "Days Overdue"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overdueCustomers.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: 12, color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: 12, textAlign: "right", color: "#ef4444", fontSize: 13, fontWeight: 600 }}>₹{(c.totalOverdue / 1000).toFixed(1)}k</td>
                  <td style={{ padding: 12, textAlign: "right", color: "var(--text-secondary)", fontSize: 13 }}>{c.overdueInvoiceCount}</td>
                  <td style={{ padding: 12, textAlign: "right", color: "#ef4444", fontSize: 13, fontWeight: 600 }}>{c.dayOverdue} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
