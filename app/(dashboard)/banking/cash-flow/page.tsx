"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Flame, Droplets, Loader2, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${(n / 1000).toFixed(0)}K`;
}

interface CashFlowSnapshot {
  month?: string;
  inflow: number;
  outflow: number;
  net: number;
  snapshotDate?: string;
}

export default function CashFlowPage() {
  const [period, setPeriod] = useState<"monthly" | "quarterly">("monthly");
  const [months, setMonths] = useState(6);
  const qc = useQueryClient();

  const key = ["banking", "cash-flow", period, months];

  const { data, isLoading } = useQuery(
    key,
    async () => {
      const periodParam = period === "monthly" ? "MONTHLY" : "QUARTERLY";
      const r = await fetch(`/api/banking/cash-flow?period=${periodParam}&months=${months}`);
      if (!r.ok) return { snapshots: [] as CashFlowSnapshot[] };
      return r.json() as Promise<{ snapshots: CashFlowSnapshot[]; source: string }>;
    },
    { staleTime: 60_000 }
  );

  const snapshots = (data?.snapshots ?? []).map(s => ({
    label: s.month ?? new Date(s.snapshotDate ?? "").toLocaleString("default", { month: "short", year: "2-digit" }),
    inflow: s.inflow,
    outflow: s.outflow,
    net: s.net,
  }));

  const rebuild = async () => {
    await fetch("/api/banking/cash-flow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ months: 12 }) });
    qc.invalidate(key);
  };

  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];
  const inflowChg = prev && prev.inflow > 0 ? ((latest.inflow - prev.inflow) / prev.inflow) * 100 : 0;
  const outflowChg = prev && prev.outflow > 0 ? ((latest.outflow - prev.outflow) / prev.outflow) * 100 : 0;
  const totalInflow = snapshots.reduce((s, r) => s + r.inflow, 0);
  const totalOutflow = snapshots.reduce((s, r) => s + r.outflow, 0);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Cash Flow</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Historical and projected cash movements</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={months} onChange={e => setMonths(Number(e.target.value))} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <option value={3}>3 Months</option>
            <option value={6}>6 Months</option>
            <option value={12}>12 Months</option>
          </select>
          <div style={{ display: "flex", gap: 0 }}>
            {(["monthly", "quarterly"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ fontSize: 12, padding: "6px 12px", border: "1px solid var(--border)", background: period === p ? "#6366f1" : "var(--bg-card)", color: period === p ? "white" : "var(--text-secondary)", cursor: "pointer", borderRadius: p === "monthly" ? "8px 0 0 8px" : "0 8px 8px 0" }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={rebuild} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <RefreshCw size={12} /> Rebuild
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 96, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />)}
        </div>
      ) : snapshots.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Total Inflow", value: formatINR(totalInflow), sub: `${months}m period`, icon: TrendingUp, color: "#10b981", change: inflowChg },
            { label: "Total Outflow", value: formatINR(totalOutflow), sub: `${months}m period`, icon: TrendingDown, color: "#ef4444", change: outflowChg },
            { label: "Net Cash Flow", value: formatINR(totalInflow - totalOutflow), sub: `${months}m net`, icon: Flame, color: (totalInflow - totalOutflow) >= 0 ? "#10b981" : "#ef4444" },
            { label: "Avg Monthly Net", value: formatINR(snapshots.length > 0 ? (totalInflow - totalOutflow) / snapshots.length : 0), sub: "per month", icon: Droplets, color: "#6366f1" },
          ].map(({ label, value, sub, icon: Icon, color, change }) => (
            <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
                <Icon size={14} color={color} />
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</p>
              {change !== undefined && (
                <p style={{ fontSize: 11, color: change >= 0 ? "#10b981" : "#ef4444", fontWeight: 600, marginTop: 4 }}>
                  {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}% vs prior
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Bar Chart — Inflow vs Outflow */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Inflow vs Outflow</h3>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Monthly comparison</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[["#10b981", "Inflow"], ["#ef4444", "Outflow"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={20} color="var(--text-muted)" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : snapshots.length === 0 ? (
          <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No cash flow data. Sync your accounts or click Rebuild.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={snapshots} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={v => formatINR(Number(v ?? 0))} />
              <Bar dataKey="inflow" name="Inflow" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="outflow" name="Outflow" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Net Cash Flow Area */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Net Cash Flow Trend</h3>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Cumulative surplus / deficit</p>
        </div>
        {isLoading ? (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={20} color="var(--text-muted)" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : snapshots.length === 0 ? (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No data available.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={snapshots} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="netGradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="netGradNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={v => formatINR(Number(v ?? 0))} />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="net" name="Net" stroke="#6366f1" fill="url(#netGradPos)" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
