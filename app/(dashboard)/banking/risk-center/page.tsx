"use client";

import { useState } from "react";
import { ShieldAlert, AlertTriangle, CheckCircle2, Eye, X, Activity, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

interface RiskAlert {
  id: string;
  riskType: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";
  resolvedAt: string | null;
  createdAt: string;
  transaction: { narration: string; transactionDate: string; credit: number | null; debit: number | null } | null;
}

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string; score: number }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.06)", text: "#ef4444", border: "rgba(239,68,68,0.3)", score: 25 },
  HIGH:     { bg: "rgba(245,158,11,0.06)", text: "#f59e0b", border: "rgba(245,158,11,0.3)", score: 15 },
  MEDIUM:   { bg: "rgba(99,102,241,0.06)", text: "#818cf8", border: "rgba(99,102,241,0.25)", score: 8 },
  LOW:      { bg: "rgba(100,116,139,0.06)", text: "#64748b", border: "rgba(100,116,139,0.2)", score: 3 },
};

const RISK_TYPE_LABELS: Record<string, string> = {
  DUPLICATE_PAYMENT: "Duplicate Payment", LARGE_WITHDRAWAL: "Large Withdrawal",
  UNUSUAL_PATTERN: "Unusual Pattern", DORMANT_ACTIVITY: "Dormant Activity",
  VENDOR_FRAUD: "Vendor Fraud", ROUND_TRIPPING: "Round Tripping",
  SUSPICIOUS_TRANSFER: "Suspicious Transfer",
};

function formatTimeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${(n / 1000).toFixed(0)}K`;
}

export default function RiskCenterPage() {
  const [filter, setFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery(
    ["banking", "risk", filter],
    async () => {
      const params = new URLSearchParams();
      if (filter === "open") params.set("status", "OPEN");
      else if (filter === "investigating") params.set("status", "INVESTIGATING");
      else if (filter === "CRITICAL" || filter === "HIGH") params.set("severity", filter);
      const r = await fetch(`/api/banking/risk?${params}`);
      if (!r.ok) return { alerts: [] as RiskAlert[], stats: [] };
      return r.json() as Promise<{ alerts: RiskAlert[]; stats: { severity: string; _count: { id: number } }[] }>;
    },
    { staleTime: 30_000 }
  );

  const alerts = data?.alerts ?? [];
  const rawStats = data?.stats ?? [];
  const countFor = (sev: string) => rawStats.find(s => s.severity === sev)?._count?.id ?? 0;

  const openCount = alerts.filter(a => a.status === "OPEN").length;
  const criticalCount = countFor("CRITICAL");
  const highCount = countFor("HIGH");
  const investigatingCount = alerts.filter(a => a.status === "INVESTIGATING").length;
  const riskScore = Math.max(0, 100 - criticalCount * 20 - highCount * 10 - openCount * 3);

  const handleUpdate = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await fetch("/api/banking/risk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      qc.invalidate(["banking", "risk"]);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldAlert size={20} color="#ef4444" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Risk Center</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Fraud detection and anomaly alerts</p>
          </div>
        </div>
        {!isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px" }}>
            <Activity size={14} color="#6366f1" />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Risk Score</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: riskScore >= 80 ? "#10b981" : riskScore >= 60 ? "#f59e0b" : "#ef4444" }}>{riskScore}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/100</span>
          </div>
        )}
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 80, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Critical", value: criticalCount, color: "#ef4444", filterVal: "CRITICAL" },
            { label: "High Risk", value: highCount, color: "#f59e0b", filterVal: "HIGH" },
            { label: "Investigating", value: investigatingCount, color: "#818cf8", filterVal: "investigating" },
            { label: "Open Total", value: openCount, color: "#64748b", filterVal: "open" },
          ].map(({ label, value, color, filterVal }) => (
            <button key={label} onClick={() => setFilter(filter === filterVal ? "all" : filterVal)}
              style={{ background: "var(--bg-card)", border: `1px solid ${filter === filterVal ? color : "var(--border)"}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}>
              <p style={{ fontSize: 24, fontWeight: 700, color }}>{value}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 6 }}>
        {[["all","All"],["open","Open"],["CRITICAL","Critical"],["HIGH","High"],["investigating","Investigating"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: filter === val ? "#6366f1" : "var(--bg-card)", color: filter === val ? "white" : "var(--text-secondary)", cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 100, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />)}
        </div>
      ) : alerts.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360, gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={28} color="#10b981" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              {filter === "all" ? "No risk alerts" : "No alerts in this category"}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {filter === "all" ? "Your accounts look clean. Risk detection runs automatically on every sync." : "Try the All filter to see all alerts."}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.map(alert => {
            const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.LOW;
            return (
              <div key={alert.id} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${cfg.text}18`, color: cfg.text }}>{alert.severity}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        {RISK_TYPE_LABELS[alert.riskType] ?? alert.riskType}
                      </span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: alert.status === "RESOLVED" ? "rgba(16,185,129,0.1)" : "var(--bg-hover)", color: alert.status === "RESOLVED" ? "#10b981" : "var(--text-muted)", border: "1px solid var(--border)" }}>
                        {alert.status}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatTimeAgo(alert.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{alert.title}</p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{alert.description}</p>
                    {alert.transaction && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                        Txn: {alert.transaction.narration} · {alert.transaction.credit ? `Credit ${formatINR(Number(alert.transaction.credit))}` : `Debit ${formatINR(Number(alert.transaction.debit ?? 0))}`}
                      </p>
                    )}
                  </div>
                  {alert.status !== "RESOLVED" && alert.status !== "DISMISSED" && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {alert.status === "OPEN" && (
                        <button onClick={() => handleUpdate(alert.id, "INVESTIGATING")} disabled={updatingId === alert.id}
                          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "#818cf8", cursor: "pointer" }}>
                          {updatingId === alert.id ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Eye size={10} />} Investigate
                        </button>
                      )}
                      <button onClick={() => handleUpdate(alert.id, "RESOLVED")} disabled={updatingId === alert.id}
                        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "none", background: "#10b981", color: "white", cursor: "pointer" }}>
                        {updatingId === alert.id ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={10} />} Resolve
                      </button>
                      <button onClick={() => handleUpdate(alert.id, "DISMISSED")} disabled={updatingId === alert.id}
                        style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-muted)" }}>
                        <X size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
