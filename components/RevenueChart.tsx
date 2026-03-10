"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { motion } from "framer-motion";

const monthlyData = [
  { month: "Sep", revenue: 28400, invoices: 18 },
  { month: "Oct", revenue: 31200, invoices: 22 },
  { month: "Nov", revenue: 29800, invoices: 19 },
  { month: "Dec", revenue: 38500, invoices: 28 },
  { month: "Jan", revenue: 42100, invoices: 31 },
  { month: "Feb", revenue: 45300, invoices: 34 },
  { month: "Mar", revenue: 51200, invoices: 39 },
];

interface RevenueChartProps {
  data?: typeof monthlyData;
  type?: "area" | "bar";
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
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
        <p
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          {label}
        </p>
        {payload.map((p, i) => (
          <p
            key={i}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {p.name === "revenue"
              ? `$${p.value.toLocaleString()}`
              : `${p.value} invoices`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RevenueChart({
  data = monthlyData,
  type = "area",
}: RevenueChartProps) {
  return (
    <motion.div
      className="chart-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h3 className="section-title">Revenue Overview</h3>
          <p className="section-subtitle">Monthly revenue trend for the last 7 months</p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            background: "var(--bg-elevated)",
            padding: 4,
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              background: "rgba(99,102,241,0.15)",
              color: "#818cf8",
            }}
          >
            7M
          </span>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            1Y
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        {type === "area" ? (
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </motion.div>
  );
}
