"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";

interface VarianceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  totalBudget: number;
  totalActual: number;
  variance: number;
  variancePct: number | null;
}
interface VarianceData {
  budget: { name: string; fiscalYear: string; granularity: string };
  rows: VarianceRow[];
  totals: { budget: number; actual: number };
}

export default function BudgetVariancePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<VarianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/budgets/${id}/vs-actual`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed to load");
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const varColor = (v: number) => (v > 0 ? "#10b981" : v < 0 ? "#ef4444" : "var(--text-muted)");

  if (loading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;
  if (error) return <p style={{ color: "#ef4444" }}>{error}</p>;
  if (!data) return null;

  const totalVariance = Math.round((data.totals.actual - data.totals.budget) * 100) / 100;

  return (
    <div>
      <Link href={`/accounting/budgets/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, marginBottom: 14, textDecoration: "none" }}><ArrowLeft size={14} /> Back to budget</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Budget vs Actual</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2, marginBottom: 20 }}>{data.budget.name} · {data.budget.fiscalYear}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <div className="surface" style={{ padding: "16px 18px" }}><p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Budgeted</p><p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>{formatCurrency(data.totals.budget)}</p></div>
        <div className="surface" style={{ padding: "16px 18px" }}><p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Actual</p><p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>{formatCurrency(data.totals.actual)}</p></div>
        <div className="surface" style={{ padding: "16px 18px" }}><p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Variance</p><p style={{ fontSize: 20, fontWeight: 700, color: varColor(totalVariance), marginTop: 4 }}>{formatCurrency(totalVariance)}</p></div>
      </div>

      <div className="surface" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", textAlign: "left" }}>
                <th style={{ padding: "12px 18px" }}>Account</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Budget</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Actual</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Variance</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Variance %</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan={5} style={{ padding: 36, textAlign: "center", color: "var(--text-muted)" }}>No budget lines yet.</td></tr>}
              {data.rows.map((r) => (
                <tr key={r.accountId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 18px", color: "var(--text-primary)" }}>{r.accountCode} — {r.accountName}</td>
                  <td style={{ padding: "10px 18px", textAlign: "right", color: "var(--text-secondary)" }}>{formatCurrency(r.totalBudget)}</td>
                  <td style={{ padding: "10px 18px", textAlign: "right", color: "var(--text-secondary)" }}>{formatCurrency(r.totalActual)}</td>
                  <td style={{ padding: "10px 18px", textAlign: "right", fontWeight: 600, color: varColor(r.variance) }}>{formatCurrency(r.variance)}</td>
                  <td style={{ padding: "10px 18px", textAlign: "right", color: varColor(r.variance) }}>{r.variancePct === null ? "—" : `${r.variancePct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
