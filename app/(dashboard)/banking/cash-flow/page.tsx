"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Flame, Droplets, Calendar, ChevronDown, AlertTriangle, BrainCircuit, ArrowUpRight, ArrowDownRight } from "lucide-react";

const MONTHLY_DATA = [
  { month: "Jan", inflow: 9800000, outflow: 7200000, net: 2600000 },
  { month: "Feb", inflow: 8400000, outflow: 6800000, net: 1600000 },
  { month: "Mar", inflow: 11200000, outflow: 8900000, net: 2300000 },
  { month: "Apr", inflow: 10600000, outflow: 9200000, net: 1400000 },
  { month: "May", inflow: 13400000, outflow: 10100000, net: 3300000 },
  { month: "Jun", inflow: 12300000, outflow: 8700000, net: 3600000 },
];

const FORECAST_DATA = [
  { month: "Jun", inflow: 12300000, outflow: 8700000, net: 3600000, forecast: false },
  { month: "Jul", inflow: 13100000, outflow: 9400000, net: 3700000, forecast: true },
  { month: "Aug", inflow: 11800000, outflow: 10200000, net: 1600000, forecast: true },
  { month: "Sep", inflow: 14200000, outflow: 9800000, net: 4400000, forecast: true },
];

const DAILY_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: `${i + 1} Jun`,
  balance: 24000000 + Math.sin(i * 0.5) * 3000000 + i * 150000,
  inflow: Math.random() * 2000000 + 400000,
  outflow: Math.random() * 1600000 + 300000,
}));

const UPCOMING_OBLIGATIONS = [
  { label: "GST Payment (Jun 20)", amount: 284000, days: 10, type: "gst", severity: "warning" },
  { label: "Payroll (Jun 30)", amount: 2340000, days: 20, type: "payroll", severity: "info" },
  { label: "AWS Invoice (Jun 25)", amount: 56000, days: 15, type: "vendor", severity: "info" },
  { label: "Loan EMI HDFC (Jul 1)", amount: 284500, days: 21, type: "loan", severity: "info" },
  { label: "TDS Q1 Deposit (Jul 7)", amount: 148000, days: 27, type: "tds", severity: "warning" },
];

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${(n / 1000).toFixed(0)}K`;
}

export default function CashFlowPage() {
  const [period, setPeriod] = useState<"daily" | "monthly" | "quarterly">("monthly");
  const [forecastHorizon, setForecastHorizon] = useState<30 | 60 | 90>(30);

  const latest = MONTHLY_DATA[MONTHLY_DATA.length - 1];
  const prev = MONTHLY_DATA[MONTHLY_DATA.length - 2];
  const inflowChg = ((latest.inflow - prev.inflow) / prev.inflow) * 100;
  const outflowChg = ((latest.outflow - prev.outflow) / prev.outflow) * 100;
  const netChg = latest.net - prev.net;
  const burnRate = latest.outflow / 30;
  const daysOfCash = Math.round(28540000 / burnRate);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Cash Flow Center</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Treasury intelligence with AI-powered forecasting</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["daily", "monthly", "quarterly"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: period === p ? "#6366f1" : "var(--bg-card)", color: period === p ? "white" : "var(--text-secondary)", cursor: "pointer", textTransform: "capitalize" }}>{p}</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Monthly Inflow", value: formatINR(latest.inflow), change: inflowChg, icon: <TrendingUp size={14} color="#10b981" />, accent: "#10b981" },
          { label: "Monthly Outflow", value: formatINR(latest.outflow), change: outflowChg, icon: <TrendingDown size={14} color="#ef4444" />, accent: "#ef4444" },
          { label: "Net Cash Flow", value: formatINR(latest.net), change: (netChg / prev.net) * 100, icon: <DollarSign size={14} color="#6366f1" />, accent: "#6366f1" },
          { label: "Days of Cash", value: `${daysOfCash}d`, change: null, icon: <Droplets size={14} color="#06b6d4" />, accent: "#06b6d4", sub: `Burn: ${formatINR(burnRate)}/day` },
        ].map((card) => (
          <div key={card.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: card.accent }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{card.label}</p>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: `${card.accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>{card.icon}</div>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{card.value}</p>
            {card.sub && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{card.sub}</p>}
            {card.change !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                {(card.change ?? 0) >= 0 ? <ArrowUpRight size={11} color="#10b981" /> : <ArrowDownRight size={11} color="#ef4444" />}
                <span style={{ fontSize: 11, fontWeight: 600, color: (card.change ?? 0) >= 0 ? "#10b981" : "#ef4444" }}>{Math.abs(card.change ?? 0).toFixed(1)}%</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>vs last month</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Monthly Inflow / Outflow */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Monthly Inflow vs Outflow</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MONTHLY_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatINR(v)} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatINR(Number(v ?? 0))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="inflow" name="Inflow" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outflow" name="Outflow" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cash Balance Trend */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Daily Balance Trend (June)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={DAILY_DATA.slice(0, 20)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatINR(v)} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatINR(Number(v ?? 0))} />
              <ReferenceLine y={5000000} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Min Threshold", fontSize: 10, fill: "#ef4444" }} />
              <Area type="monotone" dataKey="balance" stroke="#6366f1" fill="url(#balanceGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Forecast + Obligations */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Forecast Chart */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <BrainCircuit size={14} color="#818cf8" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>AI Cash Flow Forecast</h3>
            </div>
            <select value={forecastHorizon} onChange={e => setForecastHorizon(+e.target.value as 30 | 60 | 90)} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={FORECAST_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatINR(v)} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatINR(Number(v ?? 0))} />
              <Area type="monotone" dataKey="inflow" stroke="#10b981" fill="none" strokeWidth={2} strokeDasharray="5 3" />
              <Area type="monotone" dataKey="net" stroke="#818cf8" fill="url(#forecastGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>Dashed lines = AI forecast · Based on historical patterns + calendar obligations</p>
        </div>

        {/* Upcoming Obligations */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Upcoming Obligations</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {UPCOMING_OBLIGATIONS.map((ob, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: ob.severity === "warning" ? "rgba(245,158,11,0.06)" : "var(--bg-hover)", border: `1px solid ${ob.severity === "warning" ? "rgba(245,158,11,0.2)" : "var(--border)"}` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: ob.severity === "warning" ? "#f59e0b" : "#6366f1", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{ob.label}</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Due in {ob.days} days</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>−{formatINR(ob.amount)}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Total Obligations (30 days)</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>−{formatINR(UPCOMING_OBLIGATIONS.reduce((s, o) => s + o.amount, 0))}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
