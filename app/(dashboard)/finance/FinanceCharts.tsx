"use client";

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface MonthlyRevenue { month: string; revenue: number; invoices: number }
interface PaymentMixItem { name: string; value: number; color: string }
interface TopCustomer { name: string; revenue: number }

interface FinanceChartsProps {
  netProfit: MonthlyRevenue[];
  displayPaymentMix: PaymentMixItem[];
  displayTopCustomers: TopCustomer[];
  isMobile?: boolean;
  isTablet?: boolean;
}

const ChartTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "10px 14px" }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color || "var(--text-primary)", marginBottom: 2 }}>
          {p.name}: ${Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export function RevenueTrendChart({ data, isMobile }: { data: MonthlyRevenue[]; isMobile?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={isMobile ? 180 : 240}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={40} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function InvoiceStatusChart({ data, isMobile }: { data: PaymentMixItem[]; isMobile?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={isMobile ? 140 : 180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
          {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
        </Pie>
        <Tooltip formatter={(value) => [`${value}%`, ""]} contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function NetProfitChart({ data, isMobile }: { data: MonthlyRevenue[]; isMobile?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={40} />
        <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, "Revenue"]} contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }} />
        <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
