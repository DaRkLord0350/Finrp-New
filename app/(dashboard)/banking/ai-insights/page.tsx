"use client";

import { useState } from "react";
import {
  BrainCircuit, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Zap, X, RefreshCw, Lightbulb, Shield, Receipt, DollarSign, Loader2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

interface AIInsight {
  id: string;
  insightType: string;
  title: string;
  summary: string;
  severity: string | null;
  createdAt: string;
}

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string; label: string; icon: React.ReactNode }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.06)", text: "#ef4444", border: "rgba(239,68,68,0.25)", label: "Critical", icon: <AlertTriangle size={14} color="#ef4444" /> },
  WARNING:  { bg: "rgba(245,158,11,0.06)", text: "#f59e0b", border: "rgba(245,158,11,0.25)", label: "Warning",  icon: <AlertTriangle size={14} color="#f59e0b" /> },
  INFO:     { bg: "rgba(99,102,241,0.06)", text: "#818cf8", border: "rgba(99,102,241,0.2)",  label: "Info",    icon: <Lightbulb size={14} color="#818cf8" /> },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  LIQUIDITY_WARNING:  <DollarSign size={14} color="#ef4444" />,
  EXPENSE_TREND:      <TrendingDown size={14} color="#f59e0b" />,
  GST_ALERT:          <Receipt size={14} color="#f59e0b" />,
  DUPLICATE_DETECTED: <Shield size={14} color="#ef4444" />,
  CUSTOMER_ANALYSIS:  <TrendingUp size={14} color="#10b981" />,
  TAX_INSIGHT:        <Receipt size={14} color="#818cf8" />,
  PAYMENT_FORECAST:   <Zap size={14} color="#06b6d4" />,
  CASH_FLOW_ALERT:    <DollarSign size={14} color="#ef4444" />,
  VENDOR_CONCENTRATION: <Shield size={14} color="#f59e0b" />,
};

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AIInsightsPage() {
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [regenerating, setRegenerating] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery(
    ["banking", "insights", filterSeverity],
    async () => {
      const r = await fetch("/api/banking/insights");
      if (!r.ok) return { insights: [] };
      return r.json() as Promise<{ insights: AIInsight[] }>;
    },
    { staleTime: 60_000 }
  );

  const allInsights = data?.insights ?? [];
  const filtered = filterSeverity === "all" ? allInsights : allInsights.filter(i => (i.severity ?? "INFO").toUpperCase() === filterSeverity);

  const counts = {
    CRITICAL: allInsights.filter(i => (i.severity ?? "").toUpperCase() === "CRITICAL").length,
    WARNING:  allInsights.filter(i => (i.severity ?? "").toUpperCase() === "WARNING").length,
    INFO:     allInsights.filter(i => !i.severity || i.severity.toUpperCase() === "INFO").length,
  };

  const handleDismiss = async (id: string) => {
    await fetch("/api/banking/insights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "dismiss" }),
    });
    qc.invalidate(["banking", "insights"]);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await fetch("/api/banking/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      qc.invalidate(["banking", "insights"]);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(129,140,248,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BrainCircuit size={20} color="#818cf8" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>AI Insights</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Intelligent analysis of your banking activity</p>
          </div>
        </div>
        <button onClick={handleRegenerate} disabled={regenerating} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: regenerating ? "not-allowed" : "pointer", opacity: regenerating ? 0.7 : 1 }}>
          {regenerating ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
          {regenerating ? "Generating…" : "Regenerate"}
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { sev: "CRITICAL", count: counts.CRITICAL, color: "#ef4444", bg: "rgba(239,68,68,0.08)", label: "Critical" },
          { sev: "WARNING", count: counts.WARNING, color: "#f59e0b", bg: "rgba(245,158,11,0.08)", label: "Warnings" },
          { sev: "INFO", count: counts.INFO, color: "#818cf8", bg: "rgba(99,102,241,0.08)", label: "Info" },
        ].map(({ sev, count, color, bg, label }) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(filterSeverity === sev ? "all" : sev)}
            style={{ padding: 16, borderRadius: 10, border: `1px solid ${filterSeverity === sev ? color : "var(--border)"}`, background: filterSeverity === sev ? bg : "var(--bg-card)", cursor: "pointer", textAlign: "left" }}
          >
            <p style={{ fontSize: 24, fontWeight: 700, color }}>{count}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6 }}>
        {[["all", "All"], ["CRITICAL", "Critical"], ["WARNING", "Warning"], ["INFO", "Info"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilterSeverity(val)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: filterSeverity === val ? "#6366f1" : "var(--bg-card)", color: filterSeverity === val ? "white" : "var(--text-secondary)", cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Insights List */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 96, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(129,140,248,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BrainCircuit size={28} color="#818cf8" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              {allInsights.length === 0 ? "No insights yet" : "No insights in this category"}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {allInsights.length === 0
                ? "Sync your accounts and click Regenerate to generate AI-powered insights."
                : "Try changing the filter or click All to see all insights."}
            </p>
          </div>
          {allInsights.length === 0 && (
            <button onClick={handleRegenerate} disabled={regenerating} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>
              <Zap size={14} /> Generate Insights
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(insight => {
            const sev = ((insight.severity ?? "INFO") as string).toUpperCase();
            const config = SEVERITY_CONFIG[sev] ?? SEVERITY_CONFIG.INFO;
            const typeIcon = TYPE_ICONS[insight.insightType] ?? <Lightbulb size={14} color="#818cf8" />;

            return (
              <div key={insight.id} style={{ background: config.bg, border: `1px solid ${config.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
                    <div style={{ padding: 6, borderRadius: 6, background: "rgba(0,0,0,0.06)", flexShrink: 0, marginTop: 1 }}>
                      {typeIcon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${config.text}18`, color: config.text }}>{config.label.toUpperCase()}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatTimeAgo(insight.createdAt)}</span>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{insight.title}</p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{insight.summary}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismiss(insight.id)}
                    title="Dismiss"
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 4, flexShrink: 0, color: "var(--text-muted)" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
