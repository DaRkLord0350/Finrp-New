"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Users, Search, Plus, Filter, ArrowRight, ShieldCheck, ReceiptText, Landmark, FileSpreadsheet, Building2, ClipboardCheck, Wallet } from "lucide-react";
import { demoClients, formatINR, type FilingState, type RiskLevel } from "@/lib/ca-hub/demo-data";
import { Kpi, FilingPill, RiskPill, PrimaryButton, MiniProgress } from "@/components/ca-hub/ui";

const RISK_FILTERS: (RiskLevel | "ALL")[] = ["ALL", "HIGH", "MEDIUM", "LOW"];

const MATRIX_COLS: { key: keyof typeof demoClients[number]["compliance"]; label: string; icon: typeof ShieldCheck }[] = [
  { key: "gst", label: "GST", icon: ReceiptText },
  { key: "tds", label: "TDS", icon: Landmark },
  { key: "itr", label: "ITR", icon: FileSpreadsheet },
  { key: "roc", label: "ROC", icon: Building2 },
  { key: "audit", label: "Audit", icon: ClipboardCheck },
  { key: "payroll", label: "Payroll", icon: Wallet },
];

function healthColor(s: number) {
  if (s >= 85) return "#10b981";
  if (s >= 70) return "#f59e0b";
  return "#ef4444";
}

export default function ClientPortfolio() {
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<RiskLevel | "ALL">("ALL");

  const clients = useMemo(() => {
    return demoClients.filter((c) => {
      const matchQ = !q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.gstin ?? "").includes(q.toUpperCase()) || c.pan.includes(q.toUpperCase());
      const matchR = risk === "ALL" || c.risk === risk;
      return matchQ && matchR;
    });
  }, [q, risk]);

  const totalFee = demoClients.reduce((s, c) => s + c.monthlyFee, 0);
  const highRisk = demoClients.filter((c) => c.risk === "HIGH").length;
  const avgHealth = Math.round(demoClients.reduce((s, c) => s + c.healthScore, 0) / demoClients.length);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(14,165,233,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={21} color="#0ea5e9" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>Client Portfolio</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Client 360 · compliance, accounting, tax &amp; documents in one record</p>
          </div>
        </div>
        <PrimaryButton icon={Plus}>Add Client</PrimaryButton>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Kpi label="Total Clients" value={demoClients.length} icon={Users} accent="#0ea5e9" sub="in this view" />
        <Kpi label="Avg Health Score" value={`${avgHealth}/100`} icon={ShieldCheck} accent={healthColor(avgHealth)} />
        <Kpi label="High Risk" value={highRisk} icon={Filter} accent="#ef4444" sub="need review" />
        <Kpi label="Recurring Fees" value={formatINR(totalFee)} icon={Wallet} accent="#10b981" sub="per month" />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 12px", flex: 1, minWidth: 220 }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, GSTIN or PAN…"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--text-primary)", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 9, padding: 3 }}>
          {RISK_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => setRisk(r)}
              style={{
                fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                background: risk === r ? "var(--bg-hover)" : "transparent",
                color: risk === r ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {r === "ALL" ? "All" : r.charAt(0) + r.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Client table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", minWidth: 920 }}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Health</th>
                {MATRIX_COLS.map((c) => <th key={c.key} style={{ textAlign: "center" }}>{c.label}</th>)}
                <th>Risk</th>
                <th>Next Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: "var(--bg-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
                        {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.type} · {c.gstin ?? c.pan}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ minWidth: 96 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: healthColor(c.healthScore) }}>{c.healthScore}</span>
                      <div style={{ width: 44 }}><MiniProgress value={c.healthScore} color={healthColor(c.healthScore)} /></div>
                    </div>
                  </td>
                  {MATRIX_COLS.map((col) => (
                    <td key={col.key} style={{ textAlign: "center" }}>
                      <MatrixDot state={c.compliance[col.key]} />
                    </td>
                  ))}
                  <td><RiskPill level={c.risk} /></td>
                  <td>
                    <p style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{c.nextDue.label}</p>
                    <p style={{ fontSize: 11, color: c.nextDue.days < 0 ? "#ef4444" : c.nextDue.days <= 7 ? "#f59e0b" : "var(--text-muted)" }}>
                      {c.nextDue.days < 0 ? `${Math.abs(c.nextDue.days)}d overdue` : c.nextDue.days === 0 ? "Due today" : `in ${c.nextDue.days}d`}
                    </p>
                  </td>
                  <td>
                    <Link href={`/ca-hub/clients/${c.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#6366f1", textDecoration: "none" }}>
                      360 <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clients.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No clients match your filters.</div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11.5, color: "var(--text-muted)" }}>
        {(["FILED", "READY", "IN_PROGRESS", "PENDING", "OVERDUE", "NA"] as FilingState[]).map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <MatrixDot state={s} />
            <FilingPill state={s} size={10.5} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MatrixDot({ state }: { state: FilingState }) {
  const map: Record<FilingState, string> = {
    FILED: "#10b981", READY: "#06b6d4", IN_PROGRESS: "#6366f1", PENDING: "#f59e0b", OVERDUE: "#ef4444", NA: "#3f3f46",
  };
  const c = map[state];
  return (
    <span title={state} style={{ display: "inline-block", width: 11, height: 11, borderRadius: "50%", background: state === "NA" ? "transparent" : c, border: state === "NA" ? "1.5px dashed var(--border)" : `2px solid ${c}`, boxShadow: state === "NA" ? "none" : `0 0 0 3px ${c}22` }} />
  );
}
