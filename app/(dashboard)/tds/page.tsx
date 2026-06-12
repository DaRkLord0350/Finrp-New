"use client";

// ============================================================
// /tds — TDS Center (Section 192 — salary TDS).
//
// Aggregates the `tax` deduction from payroll runs via the
// existing GET /api/erp/payroll route, grouped by pay period.
// Tenant- and workspace-aware like every other customer module:
// a CA inside a client workspace sees the client's TDS position.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Percent, RefreshCw, Users, IndianRupee, CalendarClock } from "lucide-react";
import { inr } from "@/components/erp/ErpModulePage";
import type { PayrollRow } from "@/app/(dashboard)/erp/payroll/page";

interface PeriodSummary {
  period: string; // "2026-04"
  employees: number;
  grossPay: number;
  tdsDeducted: number;
  lastPaidAt: string;
}

function Skeleton({ height = 20 }: { height?: number }) {
  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 6,
        background: "var(--bg-elevated)",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

function periodLabel(period: string): string {
  // "2026-04" → "Apr 2026"; tolerate free-form periods
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  return format(new Date(Number(m[1]), Number(m[2]) - 1, 1), "MMM yyyy");
}

/** Indian financial year (Apr–Mar) for a pay period. */
function financialYear(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return "—";
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 4 ? `FY ${year}-${(year + 1) % 100}` : `FY ${year - 1}-${year % 100}`;
}

export default function TdsPage() {
  const [rows, setRows] = useState<PayrollRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/erp/payroll");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loading = rows === null;

  const periods = useMemo<PeriodSummary[]>(() => {
    const map = new Map<string, PeriodSummary>();
    for (const r of rows ?? []) {
      if (Number(r.tax) <= 0) continue;
      const existing = map.get(r.payPeriod);
      if (existing) {
        existing.employees += 1;
        existing.grossPay += Number(r.grossPay);
        existing.tdsDeducted += Number(r.tax);
        if (r.paidAt > existing.lastPaidAt) existing.lastPaidAt = r.paidAt;
      } else {
        map.set(r.payPeriod, {
          period: r.payPeriod,
          employees: 1,
          grossPay: Number(r.grossPay),
          tdsDeducted: Number(r.tax),
          lastPaidAt: r.paidAt,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.period.localeCompare(a.period));
  }, [rows]);

  const totalTds = periods.reduce((s, p) => s + p.tdsDeducted, 0);
  const employeesCovered = new Set((rows ?? []).filter((r) => Number(r.tax) > 0).map((r) => r.employeeName)).size;
  const latest = periods[0];

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="section-title">TDS Center</h1>
          <p className="section-subtitle">
            Tax deducted at source from payroll (Section 192), grouped by pay period.
          </p>
        </div>
        <button
          onClick={() => {
            setRows(null);
            load();
          }}
          className="btn-ghost"
          style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 20,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total TDS Deducted", value: inr(totalTds), color: "#f59e0b", icon: IndianRupee },
          { label: "Latest Period", value: latest ? periodLabel(latest.period) : "—", color: "#6366f1", icon: CalendarClock },
          { label: "Latest Period TDS", value: latest ? inr(latest.tdsDeducted) : "—", color: "#0ea5e9", icon: Percent },
          { label: "Employees Covered", value: String(employeesCovered), color: "#10b981", icon: Users },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ minWidth: 0 }}>
                  {loading ? (
                    <Skeleton height={30} />
                  ) : (
                    <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
                  )}
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
                </div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    flexShrink: 0,
                    background: `${s.color}1a`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={16} color={s.color} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Period table */}
      {loading ? (
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </div>
      ) : periods.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Percent size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              No TDS deductions yet
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 360, textAlign: "center" }}>
              TDS deducted from payroll runs (the income-tax component of salary deductions)
              will appear here grouped by pay period.
            </p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Pay Period</th>
                <th>Financial Year</th>
                <th>Employees</th>
                <th style={{ textAlign: "right" }}>Gross Salary</th>
                <th style={{ textAlign: "right" }}>TDS Deducted</th>
                <th style={{ textAlign: "right" }}>Effective Rate</th>
                <th>Last Paid</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.period}>
                  <td style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                    {periodLabel(p.period)}
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{financialYear(p.period)}</td>
                  <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p.employees}</td>
                  <td style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "right" }}>
                    {inr(p.grossPay)}
                  </td>
                  <td style={{ fontSize: 13.5, fontWeight: 600, color: "#f59e0b", textAlign: "right" }}>
                    {inr(p.tdsDeducted)}
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--text-muted)", textAlign: "right" }}>
                    {p.grossPay > 0 ? `${((p.tdsDeducted / p.grossPay) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {format(new Date(p.lastPaidAt), "dd MMM yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
