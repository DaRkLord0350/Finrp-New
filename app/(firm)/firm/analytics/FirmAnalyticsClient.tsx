"use client";

import dynamic from "next/dynamic";
import { TrendingUp, Users, CheckCircle2, AlertTriangle, Clock, Target } from "lucide-react";
import type { FirmAnalytics } from "@/lib/services/firm-analytics.service";

const BarChart = dynamic(() => import("recharts").then((m) => ({ default: m.BarChart })), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => ({ default: m.Bar })), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => ({ default: m.LineChart })), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => ({ default: m.Line })), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => ({ default: m.XAxis })), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => ({ default: m.YAxis })), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => ({ default: m.CartesianGrid })), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => ({ default: m.Tooltip })), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => ({ default: m.Legend })), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => ({ default: m.ResponsiveContainer })), { ssr: false });

const tooltipStyle = { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

export default function FirmAnalyticsClient({ data }: { data: FirmAnalytics }) {
  const { kpis, monthlyCompletion, caProductivity, customerGrowth, topPerformers } = data;

  const kpiCards = [
    { label: "Compliance Rate", value: `${kpis.complianceRate}%`, icon: Target, color: "#10b981", bg: "rgba(16,185,129,0.1)", desc: "Tasks completed" },
    { label: "Total Clients", value: kpis.totalCustomers, icon: Users, color: "#6366f1", bg: "rgba(99,102,241,0.1)", desc: "Registered clients" },
    { label: "Active Clients", value: kpis.activeCustomers, icon: Users, color: "#0ea5e9", bg: "rgba(14,165,233,0.1)", desc: "With pending tasks" },
    { label: "Completed Tasks", value: kpis.completedTasks, icon: CheckCircle2, color: "#10b981", bg: "rgba(16,185,129,0.1)", desc: "All time" },
    { label: "Overdue Tasks", value: kpis.overdueTasks, icon: AlertTriangle, color: "#ef4444", bg: "rgba(239,68,68,0.1)", desc: "Needs attention" },
    { label: "Pending Tasks", value: kpis.pendingTasks, icon: Clock, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", desc: "In queue" },
  ];

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">Firm Analytics</h1>
          <p className="section-subtitle">Performance metrics and compliance insights</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
        {kpiCards.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="stat-card">
              <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} color={m.color} />
                </div>
              </div>
              <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{m.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{m.label}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.desc}</p>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <TrendingUp size={15} color="#6366f1" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Monthly Task Completion</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyCompletion} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.4} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Users size={15} color="#0ea5e9" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Client Growth</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={customerGrowth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" name="New Clients" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4, fill: "#0ea5e9" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <CheckCircle2 size={15} color="#10b981" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>CA Productivity</h3>
          </div>
          {caProductivity.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No CA data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={caProductivity} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={80} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Target size={15} color="#f59e0b" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Top Performers (This Month)</h3>
          </div>
          {topPerformers.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No completed tasks this month yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topPerformers.map((p, i) => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: i === 0 ? "rgba(245,158,11,0.15)" : "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? "#f59e0b" : "var(--text-muted)" }}>#{i + 1}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>{p.completedThisMonth}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>tasks</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 20, padding: 16, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Overall Compliance Rate</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: "#10b981" }}>{kpis.complianceRate}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#34d399" }}>%</span>
            </div>
            <div style={{ marginTop: 8, height: 6, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${kpis.complianceRate}%`, background: "linear-gradient(90deg, #10b981, #34d399)", borderRadius: 99 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
