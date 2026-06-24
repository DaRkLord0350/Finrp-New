"use client";

import dynamic from "next/dynamic";
import { TrendingUp, CheckCircle2, Activity } from "lucide-react";
import type { MonthPoint, CaWorkloadPoint } from "@/lib/firm/dashboard";

const AreaChart = dynamic(() => import("recharts").then((m) => ({ default: m.AreaChart })), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => ({ default: m.Area })), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => ({ default: m.BarChart })), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => ({ default: m.Bar })), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => ({ default: m.XAxis })), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => ({ default: m.YAxis })), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => ({ default: m.CartesianGrid })), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => ({ default: m.Tooltip })), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => ({ default: m.ResponsiveContainer })), { ssr: false });

const tooltipStyle = { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };
const axisStyle = { fontSize: 11, fill: "var(--text-muted)" };

function ChartCard({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section-card">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ color }}>{icon}</span>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
      </div>
      <div style={{ width: "100%", height: 220 }}>{children}</div>
    </div>
  );
}

export default function DashboardCharts({
  customerGrowth,
  taskCompletion,
  caWorkload,
}: {
  customerGrowth: MonthPoint[];
  taskCompletion: MonthPoint[];
  caWorkload: CaWorkloadPoint[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }} className="firm-dash-charts">
      <ChartCard title="Customer Growth" icon={<TrendingUp size={16} />} color="#6366f1">
        <ResponsiveContainer>
          <AreaChart data={customerGrowth} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="cgFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="value" name="Customers" stroke="#6366f1" strokeWidth={2} fill="url(#cgFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Task Completion Trend" icon={<CheckCircle2 size={16} />} color="#10b981">
        <ResponsiveContainer>
          <BarChart data={taskCompletion} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
            <Bar dataKey="value" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="CA Workload Distribution" icon={<Activity size={16} />} color="#0ea5e9">
        {caWorkload.length === 0 ? (
          <div className="empty-state" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No active CAs yet</p>
          </div>
        ) : (
          <ResponsiveContainer>
            <BarChart layout="vertical" data={caWorkload} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={64} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(14,165,233,0.08)" }} />
              <Bar dataKey="customers" name="Customers" fill="#0ea5e9" radius={[0, 4, 4, 0]} maxBarSize={22} />
              <Bar dataKey="openTasks" name="Open Tasks" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
