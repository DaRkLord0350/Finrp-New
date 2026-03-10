"use client";

import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, DollarSign, Users, FileText, BarChart3 } from "lucide-react";
import StatCard from "@/components/StatCard";

const revenueData = [
  { month: "Sep", revenue: 28400, expenses: 18200 },
  { month: "Oct", revenue: 31200, expenses: 19800 },
  { month: "Nov", revenue: 29800, expenses: 17500 },
  { month: "Dec", revenue: 38500, expenses: 22100 },
  { month: "Jan", revenue: 42100, expenses: 24300 },
  { month: "Feb", revenue: 45300, expenses: 25800 },
  { month: "Mar", revenue: 51200, expenses: 28400 },
];

const topCustomers = [
  { name: "NovaBuild Co", revenue: 67400 },
  { name: "Acme Corp", revenue: 42500 },
  { name: "BrightStar Inc", revenue: 31200 },
  { name: "TechFlow Ltd", revenue: 18300 },
  { name: "Apex Digital", revenue: 14200 },
];

const paymentMixData = [
  { name: "Paid", value: 68, color: "#10b981" },
  { name: "Outstanding", value: 20, color: "#3b82f6" },
  { name: "Overdue", value: 8, color: "#ef4444" },
  { name: "Draft", value: 4, color: "#52525b" },
];

const stats = [
  { title: "Total Revenue", value: "$265,100", change: 13.2, changeLabel: "YTD vs last year", icon: DollarSign, iconColor: "#6366f1" },
  { title: "Gross Profit", value: "$152,800", change: 9.4, changeLabel: "YTD vs last year", icon: TrendingUp, iconColor: "#10b981" },
  { title: "Avg Deal Size", value: "$6,800", change: 5.1, changeLabel: "vs last quarter", icon: FileText, iconColor: "#3b82f6" },
  { title: "Active Customers", value: "124", change: 8.1, changeLabel: "vs last month", icon: Users, iconColor: "#f59e0b" },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string; }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
        borderRadius: 10, padding: "10px 14px", boxShadow: "var(--shadow-md)",
      }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color || "var(--text-primary)", marginBottom: 2 }}>
            {p.name}: ${p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function FinancePage() {
  const netProfit = revenueData.map(d => ({
    ...d,
    profit: d.revenue - d.expenses,
  }));

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Finance Analytics
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
          Revenue performance, profitability metrics, and customer insights.
        </p>
      </div>

      {/* KPI Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {stats.map((stat, i) => (
          <StatCard key={stat.title} {...stat} index={i} />
        ))}
      </div>

      {/* Revenue vs Expenses */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        <motion.div
          className="chart-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 className="section-title">Revenue vs Expenses</h3>
            <p className="section-subtitle">Monthly comparison for 2025</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)", paddingTop: 10 }}
                formatter={(value) => <span style={{ color: "var(--text-secondary)" }}>{value}</span>}
              />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Invoice Status Mix */}
        <motion.div
          className="chart-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 className="section-title">Invoice Status</h3>
            <p className="section-subtitle">Payment distribution</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={paymentMixData}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {paymentMixData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value}%`, ""]}
                contentStyle={{
                  background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
                  borderRadius: 8, color: "var(--text-primary)", fontSize: 13,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {paymentMixData.map((d) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{d.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Net Profit + Top Customers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <motion.div
          className="chart-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 className="section-title">Net Profit Trend</h3>
            <p className="section-subtitle">Monthly profitability</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={netProfit}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v) => [`$${Number(v).toLocaleString()}`, "Net Profit"]}
                contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }}
              />
              <Bar dataKey="profit" name="Net Profit" fill="#10b981" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          className="chart-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 className="section-title">Top Customers</h3>
            <p className="section-subtitle">By total revenue contribution</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topCustomers.map((c, i) => {
              const pct = (c.revenue / topCustomers[0].revenue) * 100;
              return (
                <div key={c.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{c.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                      ${c.revenue.toLocaleString()}
                    </span>
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
        </motion.div>
      </div>
    </div>
  );
}
