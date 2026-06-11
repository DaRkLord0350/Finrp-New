"use client";

import { useState } from "react";
import {
  ShieldCheck, AlertTriangle, CalendarClock, CheckCircle2, Bell, ChevronLeft,
  ChevronRight, Filter,
} from "lucide-react";
import { demoDeadlines, demoClients, type DemoDeadline } from "@/lib/ca-hub/demo-data";
import { Kpi, Panel, FilingPill, DueChip, RiskPill, PrimaryButton } from "@/components/ca-hub/ui";

const CAT_COLOR: Record<DemoDeadline["category"], string> = {
  GST: "#f59e0b", TDS: "#06b6d4", "Income Tax": "#8b5cf6", ROC: "#f43f5e", Audit: "#ec4899", "PF/ESI": "#10b981",
};

// June 2026 starts on a Monday (2026-06-01 = Monday). 30 days.
const MONTH_LABEL = "June 2026";
const DAYS_IN_MONTH = 30;
const FIRST_WEEKDAY = 1; // 0=Sun … 1=Mon

export default function ComplianceCenter() {
  const [cat, setCat] = useState<"ALL" | DemoDeadline["category"]>("ALL");

  const deadlinesByDay = new Map<number, DemoDeadline[]>();
  demoDeadlines.forEach((d) => {
    const dt = new Date(d.dueDate);
    if (dt.getMonth() === 5 && dt.getFullYear() === 2026) {
      const day = dt.getDate();
      deadlinesByDay.set(day, [...(deadlinesByDay.get(day) ?? []), d]);
    }
  });

  const filtered = demoDeadlines.filter((d) => cat === "ALL" || d.category === cat);
  const overdue = demoDeadlines.filter((d) => d.daysLeft < 0);
  const dueThisWeek = demoDeadlines.filter((d) => d.daysLeft >= 0 && d.daysLeft <= 7);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(16,185,129,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={21} color="#10b981" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>Compliance Command Center</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Calendar · due dates · risk indicators · overdue tracking</p>
          </div>
        </div>
        <PrimaryButton icon={Bell}>Send Reminders</PrimaryButton>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Kpi label="Overdue" value={overdue.length} icon={AlertTriangle} accent="#ef4444" sub="needs escalation" />
        <Kpi label="Due This Week" value={dueThisWeek.length} icon={CalendarClock} accent="#f59e0b" />
        <Kpi label="On-time Rate" value="96.1%" icon={CheckCircle2} accent="#10b981" sub="trailing 12m" />
        <Kpi label="Reminders Sent" value={128} icon={Bell} accent="#6366f1" sub="this month" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        {/* Calendar */}
        <Panel
          title={`Compliance Calendar · ${MONTH_LABEL}`}
          action={
            <div style={{ display: "flex", gap: 4 }}>
              <button style={navBtn}><ChevronLeft size={15} /></button>
              <button style={navBtn}><ChevronRight size={15} /></button>
            </div>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", paddingBottom: 4, letterSpacing: "0.04em" }}>{d}</div>
            ))}
            {Array.from({ length: FIRST_WEEKDAY }).map((_, i) => <div key={`pad${i}`} />)}
            {Array.from({ length: DAYS_IN_MONTH }).map((_, i) => {
              const day = i + 1;
              const items = deadlinesByDay.get(day) ?? [];
              const isToday = day === 11;
              return (
                <div
                  key={day}
                  style={{
                    minHeight: 58, borderRadius: 8, padding: "5px 6px",
                    border: isToday ? "1.5px solid #6366f1" : "1px solid var(--border)",
                    background: isToday ? "rgba(99,102,241,0.07)" : "var(--bg-card)",
                    display: "flex", flexDirection: "column", gap: 3,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? "#818cf8" : "var(--text-secondary)" }}>{day}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {items.slice(0, 2).map((it) => (
                      <span key={it.id} title={`${it.client} · ${it.obligation}`} style={{ fontSize: 8.5, fontWeight: 600, color: "white", background: CAT_COLOR[it.category], borderRadius: 3, padding: "1px 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.category}
                      </span>
                    ))}
                    {items.length > 2 && <span style={{ fontSize: 8.5, color: "var(--text-muted)" }}>+{items.length - 2}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Category legend */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
            {(Object.keys(CAT_COLOR) as DemoDeadline["category"][]).map((c) => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: CAT_COLOR[c] }} />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Risk indicators */}
        <Panel title="Client Risk Indicators" subtitle="Ranked by compliance risk">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...demoClients].sort((a, b) => a.healthScore - b.healthScore).slice(0, 6).map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "var(--bg-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)" }}>
                  {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.openTasks} open · {c.nextDue.label}</p>
                </div>
                <RiskPill level={c.risk} size={10} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Due-date ledger */}
      <Panel
        title="Due Date Ledger"
        subtitle="All upcoming & overdue obligations"
        action={
          <div style={{ display: "flex", gap: 4, background: "var(--bg-hover)", borderRadius: 8, padding: 3, flexWrap: "wrap" }}>
            {(["ALL", "GST", "TDS", "Income Tax", "ROC", "Audit", "PF/ESI"] as const).map((c) => (
              <button key={c} onClick={() => setCat(c)} style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: cat === c ? "var(--bg-card)" : "transparent", color: cat === c ? "var(--text-primary)" : "var(--text-muted)" }}>
                {c === "ALL" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Filter size={11} />All</span> : c}
              </button>
            ))}
          </div>
        }
      >
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead><tr><th>Client</th><th>Obligation</th><th>Category</th><th>Due</th><th>Status</th><th>Assignee</th></tr></thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.client}</td>
                  <td>{d.obligation}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: CAT_COLOR[d.category] }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: CAT_COLOR[d.category] }} />{d.category}
                    </span>
                  </td>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(d.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span><DueChip days={d.daysLeft} /></div></td>
                  <td><FilingPill state={d.status} /></td>
                  <td><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{d.assignee}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)",
  color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};
