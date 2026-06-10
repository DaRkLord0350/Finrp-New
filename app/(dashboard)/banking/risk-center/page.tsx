"use client";

import { useState } from "react";
import { ShieldAlert, AlertTriangle, XCircle, CheckCircle2, Eye, Flag, X, Activity } from "lucide-react";

const RISK_ALERTS = [
  { id: "1", riskType: "DUPLICATE_PAYMENT", severity: "CRITICAL", title: "Duplicate payment detected", description: "REF984512 from Rajesh Traders appears in bank on Jun 10 AND Jun 6. Same amount ₹4.87L. Verify if intentional double payment.", transactionId: "b1", amount: 487500, date: "Jun 10", bank: "HDFC Bank", status: "OPEN" },
  { id: "2", riskType: "LARGE_WITHDRAWAL", severity: "HIGH", title: "Unusual large withdrawal — ₹23.4L", description: "Salary batch payment of ₹23.4L on Jun 8 — largest single outflow this month. Matches payroll schedule but verify headcount.", transactionId: "b5", amount: 2340000, date: "Jun 8", bank: "SBI", status: "OPEN" },
  { id: "3", riskType: "UNUSUAL_PATTERN", severity: "MEDIUM", title: "Infrequent vendor payment schedule change", description: "Anand Steel Works typically paid weekly. This payment (CHQ 009241) is 3 weeks early. Verify if advance payment was authorized.", transactionId: "b7", amount: 340000, date: "Jun 7", bank: "HDFC Bank", status: "INVESTIGATING" },
  { id: "4", riskType: "DORMANT_ACTIVITY", severity: "MEDIUM", title: "Activity on dormant account", description: "Kotak Mahindra account (XXXX3321) had no transactions for 6 months. Received ₹1.2L credit on Jun 5. Verify legitimacy.", transactionId: null, amount: 120000, date: "Jun 5", bank: "Kotak Mahindra", status: "OPEN" },
  { id: "5", riskType: "VENDOR_FRAUD", severity: "HIGH", title: "New bank details for existing vendor", description: "Vendor 'Sunrise Exports Ltd' payment routed to new account ending 9901 (previously 4521). Verify change request was authorized.", transactionId: null, amount: 924000, date: "Jun 8", bank: "HDFC Bank", status: "RESOLVED" },
];

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", border: "rgba(239,68,68,0.3)" },
  HIGH:     { bg: "rgba(245,158,11,0.08)", text: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  MEDIUM:   { bg: "rgba(99,102,241,0.08)", text: "#818cf8", border: "rgba(99,102,241,0.25)" },
  LOW:      { bg: "rgba(100,116,139,0.08)", text: "#64748b", border: "rgba(100,116,139,0.2)" },
};

const RISK_TYPE_LABELS: Record<string, string> = {
  DUPLICATE_PAYMENT: "Duplicate Payment", LARGE_WITHDRAWAL: "Large Withdrawal",
  UNUSUAL_PATTERN: "Unusual Pattern", DORMANT_ACTIVITY: "Dormant Activity",
  VENDOR_FRAUD: "Vendor Fraud", ROUND_TRIPPING: "Round Tripping",
  SUSPICIOUS_TRANSFER: "Suspicious Transfer",
};

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function RiskCenterPage() {
  const [alerts, setAlerts] = useState(RISK_ALERTS);
  const [filter, setFilter] = useState("all");

  const filtered = alerts.filter(a => {
    if (filter === "open") return a.status === "OPEN";
    if (filter === "CRITICAL") return a.severity === "CRITICAL";
    if (filter === "HIGH") return a.severity === "HIGH";
    return true;
  });

  const stats = {
    open: alerts.filter(a => a.status === "OPEN").length,
    critical: alerts.filter(a => a.severity === "CRITICAL").length,
    investigating: alerts.filter(a => a.status === "INVESTIGATING").length,
    resolved: alerts.filter(a => a.status === "RESOLVED").length,
  };

  const riskScore = Math.max(0, 100 - (stats.critical * 25) - (stats.open * 10));

  const updateStatus = (id: string, status: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Risk Center</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Fraud detection & financial risk monitoring</p>
        </div>
      </div>

      {/* Risk Score + Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 100, height: 100, marginBottom: 10 }}>
            <svg viewBox="0 0 36 36" width="100" height="100" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={riskScore >= 80 ? "#10b981" : riskScore >= 60 ? "#f59e0b" : "#ef4444"} strokeWidth="3" strokeDasharray={`${riskScore} 100`} strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: riskScore >= 80 ? "#10b981" : riskScore >= 60 ? "#f59e0b" : "#ef4444" }}>{riskScore}</p>
              <p style={{ fontSize: 9, color: "var(--text-muted)" }}>RISK SCORE</p>
            </div>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: riskScore >= 80 ? "#10b981" : riskScore >= 60 ? "#f59e0b" : "#ef4444" }}>{riskScore >= 80 ? "Low Risk" : riskScore >= 60 ? "Medium Risk" : "High Risk"}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            ["Open Alerts", stats.open, "#ef4444", <AlertTriangle size={14} color="#ef4444" />],
            ["Critical", stats.critical, "#ef4444", <XCircle size={14} color="#ef4444" />],
            ["Investigating", stats.investigating, "#f59e0b", <Activity size={14} color="#f59e0b" />],
            ["Resolved", stats.resolved, "#10b981", <CheckCircle2 size={14} color="#10b981" />],
          ].map(([label, value, color, icon]) => (
            <div key={String(label)} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon as React.ReactNode}</div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{label as string}</p>
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: String(color) }}>{value as React.ReactNode}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6 }}>
        {[["all", "All Alerts"], ["open", "Open"], ["CRITICAL", "Critical"], ["HIGH", "High"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: filter === v ? "#6366f1" : "var(--bg-card)", color: filter === v ? "white" : "var(--text-secondary)", cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {/* Alert List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((alert) => {
          const s = SEVERITY_CONFIG[alert.severity];
          return (
            <div key={alert.id} style={{ background: alert.status === "RESOLVED" ? "var(--bg-card)" : s.bg, border: `1px solid ${alert.status === "RESOLVED" ? "var(--border)" : s.border}`, borderRadius: 12, padding: "16px 18px", opacity: alert.status === "RESOLVED" ? 0.7 : 1 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.text}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ShieldAlert size={16} color={s.text} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `${s.text}20`, color: s.text }}>{alert.severity}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{RISK_TYPE_LABELS[alert.riskType]}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)" }}>{alert.date} · {alert.bank}</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{alert.title}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{alert.description}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>{formatINR(alert.amount)}</span>
                    {alert.status !== "RESOLVED" && (
                      <>
                        <button onClick={() => updateStatus(alert.id, "INVESTIGATING")} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer" }}>Investigate</button>
                        <button onClick={() => updateStatus(alert.id, "RESOLVED")} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "#10b981", color: "white", cursor: "pointer", fontWeight: 600 }}>Resolve</button>
                        <button onClick={() => updateStatus(alert.id, "DISMISSED")} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", cursor: "pointer" }}>Dismiss</button>
                      </>
                    )}
                    {alert.status === "RESOLVED" && <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={10} /> Resolved</span>}
                    {alert.status === "INVESTIGATING" && <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Activity size={10} /> Under Investigation</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
