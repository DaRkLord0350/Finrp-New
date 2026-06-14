"use client";

// ============================================================
// ErpModulePage — shared list page for the ERP record modules
// (Sales, Purchases, Expenses, Payroll). One component, four
// pages: each page supplies columns, stats and a search filter.
//
// Data comes from the existing /api/erp/* routes, which resolve
// the tenant through getTenantId() — so the same pages serve a
// customer's own org AND a CA inside a client workspace.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Inbox } from "lucide-react";

export const inr = (n: unknown) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export interface ErpColumn<T> {
  header: string;
  align?: "right";
  render: (row: T) => React.ReactNode;
}

export interface ErpStat {
  label: string;
  value: string;
  color: string;
}

interface ErpModulePageProps<T> {
  title: string;
  subtitle: string;
  fetchUrl: string;
  getId: (row: T) => string;
  columns: ErpColumn<T>[];
  buildStats: (rows: T[]) => ErpStat[];
  searchFilter: (row: T, query: string) => boolean;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyHint: string;
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

export default function ErpModulePage<T>({
  title,
  subtitle,
  fetchUrl,
  getId,
  columns,
  buildStats,
  searchFilter,
  searchPlaceholder,
  emptyTitle,
  emptyHint,
}: ErpModulePageProps<T>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    }
  }, [fetchUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const loading = rows === null;
  const stats = useMemo(() => buildStats(rows ?? []), [rows, buildStats]);
  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => searchFilter(r, q));
  }, [rows, query, searchFilter]);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="section-title">{title}</h1>
          <p className="section-subtitle">{subtitle}</p>
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

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
          gap: 16,
          marginBottom: 28,
        }}
      >
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            {loading ? (
              <Skeleton height={32} />
            ) : (
              <p style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</p>
            )}
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          marginBottom: 16,
          maxWidth: 380,
        }}
      >
        <Search size={14} color="var(--text-muted)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontSize: 13,
          }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Inbox size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              {query ? "No matching records" : emptyTitle}
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 340, textAlign: "center" }}>
              {query ? "Try a different search term." : emptyHint}
            </p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header} style={c.align === "right" ? { textAlign: "right" } : undefined}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={getId(row)}>
                  {columns.map((c) => (
                    <td key={c.header} style={c.align === "right" ? { textAlign: "right" } : undefined}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
