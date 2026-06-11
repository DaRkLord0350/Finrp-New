"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, ReceiptText, Landmark, FileSpreadsheet, Building2, ClipboardCheck,
  TrendingUp, Timer, Plus, ArrowRight, AlertTriangle, Activity,
  CheckCircle2, Gauge, Briefcase,
} from "lucide-react";
import {
  practiceKpis, revenueTrend, complianceLoad, filingStatusMix,
  teamProductivity, demoDeadlines, formatINR,
} from "@/lib/ca-hub/demo-data";
import { Kpi, Panel, FilingPill, DueChip, PrimaryButton, GhostButton } from "@/components/ca-hub/ui";

const PERIODS = [
  { v: "this_month", l: "This Month" },
  { v: "this_quarter", l: "This Quarter" },
  { v: "this_fy", l: "FY 2026-27" },
  { v: "last_fy", l: "FY 2025-26" },
];

export default function PracticeDashboard() {
  const [period, setPeriod] = useState("this_month");
  const k = practiceKpis;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "linear-gradient(135deg, #6366f1, #0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 14px rgba(99,102,241,0.35)" }}>
            <Briefcase size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Practice Dashboard</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Mehta &amp; Associates · {k.activeClients} active engagements</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ fontSize: 12, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}
          >
            {PERIODS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
          <GhostButton href="/ca-hub/clients" icon={Users}>Clients</GhostButton>
          <PrimaryButton icon={Plus}>New Client</PrimaryButton>
        </div>
      </div>

      {/* Overdue alert strip */}
      {k.overdue > 0 && (
        <Link href="/ca-hub/compliance" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderRadius: 11, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)" }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
              <b>{k.overdue} filings are overdue</b> across {Math.min(k.overdue, 5)} clients — immediate attention required.
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
              Resolve <ArrowRight size={13} />
            </span>
          </div>
        </Link>
      )}

      {/* KPI Row 1 — obligations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Kpi label="Total Clients" value={k.totalClients} icon={Users} accent="#0ea5e9" sub={`${k.activeClients} active`} change={4.6} />
        <Kpi label="GST Due" value={k.gstDue} icon={ReceiptText} accent="#f59e0b" sub="returns this cycle" />
        <Kpi label="TDS Due" value={k.tdsDue} icon={Landmark} accent="#06b6d4" sub="quarterly returns" />
        <Kpi label="ITR Due" value={k.itrDue} icon={FileSpreadsheet} accent="#8b5cf6" sub="AY 2026-27" />
      </div>

      {/* KPI Row 2 — assurance + performance */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Kpi label="ROC Due" value={k.rocDue} icon={Building2} accent="#f43f5e" sub="MCA forms" />
        <Kpi label="Audit Pending" value={k.auditPending} icon={ClipboardCheck} accent="#ec4899" sub="awaiting sign-off" />
        <Kpi label="Revenue (MTD)" value={formatINR(k.revenueMTD)} icon={TrendingUp} accent="#10b981" change={k.revenueGrowth} />
        <Kpi label="On-time Filing" value={`${k.onTimeFilingRate}%`} icon={Gauge} accent="#22c55e" sub="trailing 12 months" />
      </div>

      {/* Charts row: revenue + filing mix */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Panel title="Revenue Analytics" subtitle="Billed vs collected · last 12 months"
          action={<span style={{ fontSize: 12, color: "var(--text-muted)" }}>WIP {formatINR(k.wip)} · Realization {k.realizationRate}%</span>}>
          <ResponsiveContainer width="100%" height={232}>
            <AreaChart data={revenueTrend} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="billGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.28} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatINR(Number(v ?? 0))} />
              <Area type="monotone" dataKey="billed" name="Billed" stroke="#6366f1" fill="url(#billGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" fill="url(#collGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Filing Status" subtitle="Across all clients">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={filingStatusMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={2}>
                {filingStatusMix.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {filingStatusMix.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, flex: 1, color: "var(--text-secondary)" }}>{s.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)" }}>{s.value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Compliance load + team productivity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Compliance Load" subtitle="Filed vs pending vs overdue, by category">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={complianceLoad} margin={{ top: 6, right: 6, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(128,128,128,0.06)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar dataKey="filed" name="Filed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pending" name="Pending" stackId="a" fill="#f59e0b" />
              <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Team Productivity" subtitle="Utilization & throughput this month"
          action={<Link href="/ca-hub/team" style={{ fontSize: 12, color: "#6366f1", textDecoration: "none" }}>Manage →</Link>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {teamProductivity.slice(0, 6).map((t) => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                  {t.name.split(" ").slice(-2).map((w) => w[0]).join("")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: t.utilization >= 85 ? "#10b981" : t.utilization >= 78 ? "#f59e0b" : "#ef4444" }}>{t.utilization}%</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 5, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${t.utilization}%`, borderRadius: 5, background: t.utilization >= 85 ? "#10b981" : t.utilization >= 78 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.completed} done</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Upcoming deadlines */}
      <Panel
        title="Upcoming Deadlines"
        subtitle="Next statutory obligations across the practice"
        action={<Link href="/ca-hub/compliance" style={{ fontSize: 12, color: "#6366f1", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>Compliance center <ArrowRight size={12} /></Link>}
      >
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Client</th><th>Obligation</th><th>Category</th><th>Due Date</th><th>Status</th><th>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {demoDeadlines.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.client}</td>
                  <td>{d.obligation}</td>
                  <td><span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{d.category}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(d.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                      <DueChip days={d.daysLeft} />
                    </div>
                  </td>
                  <td><FilingPill state={d.status} /></td>
                  <td><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{d.assignee}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Footer mini-stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { icon: Activity, label: "Revenue YTD", value: formatINR(k.revenueYTD), accent: "#10b981" },
          { icon: Timer, label: "Work in Progress", value: formatINR(k.wip), accent: "#f59e0b" },
          { icon: CheckCircle2, label: "Realization Rate", value: `${k.realizationRate}%`, accent: "#6366f1" },
          { icon: Gauge, label: "Team Utilization", value: `${k.teamUtilization}%`, accent: "#0ea5e9" },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${s.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <s.icon size={18} color={s.accent} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{s.label}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
