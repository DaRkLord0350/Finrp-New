"use client";

import { useState } from "react";
import { BrainCircuit, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Zap, X, ChevronRight, RefreshCw, Lightbulb, Shield, Receipt, DollarSign } from "lucide-react";

const INSIGHTS = [
  { id: "1", type: "LIQUIDITY_WARNING", severity: "critical", title: "Cash crunch risk in ~14 days", summary: "At current burn rate of ₹2.9L/day, available balance may fall below the ₹50L safety threshold around Jun 24, 2026.", detail: "Analysis: Monthly outflow has increased 18% vs May. Key drivers: vendor payments up ₹3.2L, new AWS infrastructure costs. Suggest reviewing discretionary spends or arranging short-term credit.", action: { label: "View Cash Flow", url: "/banking/cash-flow" }, isRead: false, createdAt: "2 hours ago" },
  { id: "2", type: "EXPENSE_TREND", severity: "warning", title: "Vendor payments increased 18% MoM", summary: "Outflows to vendors grew from ₹71.2L (May) to ₹84.1L (June). Top contributors: AWS (↑₹56K), Raw Materials (↑₹1.8L), Contract Labour (↑₹2.1L).", detail: null, action: { label: "Review Transactions", url: "/banking/transactions" }, isRead: false, createdAt: "4 hours ago" },
  { id: "3", type: "GST_ALERT", severity: "warning", title: "GST liability ₹2.84L due Jun 20", summary: "Based on current month sales, estimated CGST+SGST liability is ₹2.84L. Ensure adequate funds in the designated tax payment account.", detail: "Current tax account balance: ₹18.4L. Sufficient funds available. Recommend earmarking ₹2.84L to avoid any shortfall.", action: { label: "Go to GST Match", url: "/banking/gst-match" }, isRead: false, createdAt: "6 hours ago" },
  { id: "4", type: "DUPLICATE_DETECTED", severity: "critical", title: "Potential duplicate payment detected", summary: "Transaction REF984512 from Rajesh Traders appears twice — on Jun 10 and Jun 6. Combined amount: ₹9.75L. Please verify before processing.", detail: null, action: { label: "Review Transactions", url: "/banking/transactions" }, isRead: true, createdAt: "1 day ago" },
  { id: "5", type: "CUSTOMER_ANALYSIS", severity: "info", title: "Top customer payment pattern shift", summary: "Sunrise Exports Ltd (previously paying on 15th) has been paying on 8th this month — 7 days early. Cash flow improving from this customer.", detail: null, action: null, isRead: true, createdAt: "2 days ago" },
  { id: "6", type: "TAX_INSIGHT", severity: "info", title: "TDS Q1 deposit due July 7", summary: "TDS collected in Q1 (₹1.48L) must be deposited by July 7. Current balance is sufficient but plan the transfer early.", detail: null, action: { label: "View Compliance", url: "/compliance" }, isRead: true, createdAt: "3 days ago" },
  { id: "7", type: "PAYMENT_FORECAST", severity: "info", title: "Payroll scheduled in 20 days", summary: "June payroll for 234 employees (~₹23.4L) is due June 30. Historical pattern shows this is 1-2 days early vs prior months.", detail: null, action: null, isRead: true, createdAt: "4 days ago" },
];

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string; label: string; icon: React.ReactNode }> = {
  critical: { bg: "rgba(239,68,68,0.06)", text: "#ef4444", border: "rgba(239,68,68,0.25)", label: "Critical", icon: <AlertTriangle size={14} color="#ef4444" /> },
  warning:  { bg: "rgba(245,158,11,0.06)", text: "#f59e0b", border: "rgba(245,158,11,0.25)", label: "Warning",  icon: <AlertTriangle size={14} color="#f59e0b" /> },
  info:     { bg: "rgba(99,102,241,0.06)", text: "#818cf8", border: "rgba(99,102,241,0.2)",  label: "Info",    icon: <Lightbulb size={14} color="#818cf8" /> },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  LIQUIDITY_WARNING:  <DollarSign size={14} color="#ef4444" />,
  EXPENSE_TREND:      <TrendingDown size={14} color="#f59e0b" />,
  GST_ALERT:          <Receipt size={14} color="#f59e0b" />,
  DUPLICATE_DETECTED: <Shield size={14} color="#ef4444" />,
  CUSTOMER_ANALYSIS:  <TrendingUp size={14} color="#10b981" />,
  TAX_INSIGHT:        <Receipt size={14} color="#818cf8" />,
  PAYMENT_FORECAST:   <Zap size={14} color="#06b6d4" />,
};

export default function AIInsightsPage() {
  const [insights, setInsights] = useState(INSIGHTS);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = insights.filter(i => {
    if (filter === "unread") return !i.isRead;
    if (filter === "critical") return i.severity === "critical";
    if (filter === "warning") return i.severity === "warning";
    return true;
  });

  const dismiss = (id: string) => setInsights(prev => prev.filter(i => i.id !== id));
  const markRead = (id: string) => setInsights(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
  const unreadCount = insights.filter(i => !i.isRead).length;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(129,140,248,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BrainCircuit size={20} color="#818cf8" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>AI Financial Copilot</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Intelligent insights powered by transaction pattern analysis</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
            <RefreshCw size={12} /> Refresh Insights
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          ["Total Insights", insights.length, "#6366f1"],
          ["Unread", unreadCount, "#f59e0b"],
          ["Critical", insights.filter(i => i.severity === "critical").length, "#ef4444"],
          ["Actions Available", insights.filter(i => i.action).length, "#10b981"],
        ].map(([label, value, color]) => (
          <div key={String(label)} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: String(color) }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6 }}>
        {[["all", "All"], ["unread", "Unread"], ["critical", "Critical"], ["warning", "Warnings"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: filter === v ? "#6366f1" : "var(--bg-card)", color: filter === v ? "white" : "var(--text-secondary)", cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {/* Insights Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((ins) => {
          const s = SEVERITY_CONFIG[ins.severity];
          const isExpanded = expanded === ins.id;
          return (
            <div key={ins.id} style={{ background: ins.isRead ? "var(--bg-card)" : s.bg, border: `1px solid ${ins.isRead ? "var(--border)" : s.border}`, borderRadius: 12, overflow: "hidden", transition: "all 0.2s ease" }}>
              <div style={{ padding: "16px 18px", display: "flex", gap: 12, cursor: "pointer" }} onClick={() => { setExpanded(isExpanded ? null : ins.id); markRead(ins.id); }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.text}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {TYPE_ICONS[ins.type] ?? s.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${s.text}20`, color: s.text }}>{s.label.toUpperCase()}</span>
                    {!ins.isRead && <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.text, display: "inline-block" }} />}
                    <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>{ins.createdAt}</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{ins.title}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{ins.summary}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); dismiss(ins.id); }} style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}><X size={12} /></button>
                  <ChevronRight size={14} color="var(--text-muted)" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </div>
              </div>

              {isExpanded && (ins.detail || ins.action) && (
                <div style={{ padding: "0 18px 16px", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  {ins.detail && <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>{ins.detail}</p>}
                  {ins.action && (
                    <a href={ins.action.url} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 7, background: s.text, color: "white", textDecoration: "none" }}>
                      {ins.action.label} <ChevronRight size={10} />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
            <CheckCircle2 size={32} color="#10b981" style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>All clear!</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No insights matching your current filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
