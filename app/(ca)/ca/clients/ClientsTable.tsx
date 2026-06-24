"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { Search, Users, Building2 } from "lucide-react";

export interface ClientRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  onboarded: boolean;
  healthScore: number;
  complianceScore: number;
  lastActivityAt: string | null;
  assignedAt: string;
  tasksOpen: number;
  tasksOverdue: number;
  complianceOverdue: number;
  awaitingDocs: number;
}

type Filter = "ALL" | "ATTENTION" | "ONBOARDING" | "HEALTHY";

function healthLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: "Healthy", color: "#10b981", bg: "rgba(16,185,129,0.1)" };
  if (score >= 70) return { label: "Minor Issues", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" };
  if (score >= 50) return { label: "Attention", color: "#f97316", bg: "rgba(249,115,22,0.1)" };
  if (score >= 30) return { label: "At Risk", color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
  return { label: "Critical", color: "#dc2626", bg: "rgba(220,38,38,0.1)" };
}

export default function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const counts = useMemo(
    () => ({
      ALL: rows.length,
      ATTENTION: rows.filter((r) => r.healthScore < 70).length,
      ONBOARDING: rows.filter((r) => !r.onboarded).length,
      HEALTHY: rows.filter((r) => r.healthScore >= 90).length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "ATTENTION" && r.healthScore >= 70) return false;
      if (filter === "ONBOARDING" && r.onboarded) return false;
      if (filter === "HEALTHY" && r.healthScore < 90) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.company ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.gstin ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  const tabs: { key: Filter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "ATTENTION", label: "Needs Attention" },
    { key: "ONBOARDING", label: "Onboarding" },
    { key: "HEALTHY", label: "Healthy" },
  ];

  if (rows.length === 0) {
    return (
      <div className="section-card">
        <div className="empty-state">
          <Users size={48} color="var(--text-muted)" />
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No clients assigned yet</p>
          <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 340, textAlign: "center" }}>
            Ask your firm admin to assign customers to you, or invite a new customer to onboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            flex: "1 1 240px",
            minWidth: 200,
          }}
        >
          <Search size={14} color="var(--text-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, company, GSTIN…"
            style={{ background: "none", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 13, width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              style={{
                padding: "7px 13px",
                borderRadius: 99,
                border: `1px solid ${filter === t.key ? "#6366f1" : "var(--border)"}`,
                background: filter === t.key ? "rgba(99,102,241,0.12)" : "transparent",
                color: filter === t.key ? "#818cf8" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state" style={{ padding: "40px 16px" }}>
            <Search size={36} color="var(--text-muted)" />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No clients match your filters.</p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>GSTIN</th>
                <th>Work</th>
                <th>Health</th>
                <th>Compliance</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const h = healthLabel(r.healthScore);
                return (
                  <tr key={r.id} style={{ cursor: "pointer" }}>
                    <td>
                      <Link href={`/ca/clients/${r.id}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 9,
                            flexShrink: 0,
                            background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Building2 size={16} color="white" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{r.name}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {r.company ?? r.email ?? "—"}
                            {!r.onboarded && (
                              <span style={{ color: "#f59e0b", marginLeft: 6 }}>· Onboarding</span>
                            )}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.gstin ?? "—"}</td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{r.tasksOpen} open</span>
                        {(r.tasksOverdue > 0 || r.complianceOverdue > 0 || r.awaitingDocs > 0) && (
                          <p style={{ color: "#ef4444", fontSize: 11 }}>
                            {[
                              r.tasksOverdue > 0 && `${r.tasksOverdue} late`,
                              r.complianceOverdue > 0 && `${r.complianceOverdue} comp.`,
                              r.awaitingDocs > 0 && `${r.awaitingDocs} docs`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, maxWidth: 70, height: 6, borderRadius: 99, background: "var(--bg-overlay)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${r.healthScore}%`, background: h.color, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: h.color }}>{r.healthScore}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: h.bg, color: h.color, borderColor: `${h.color}30` }}>
                        {r.complianceScore}%
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {r.lastActivityAt
                        ? formatDistanceToNow(new Date(r.lastActivityAt), { addSuffix: true })
                        : format(new Date(r.assignedAt), "dd MMM yyyy")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
