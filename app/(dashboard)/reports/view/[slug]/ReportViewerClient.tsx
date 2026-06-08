"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  RefreshCw, Download, Printer, Star, Filter, TrendingUp, TrendingDown,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { getReport, REPORTS } from "@/lib/reports/registry";
import type { ReportResult, ReportColumn } from "@/lib/reports/types";
import ReportFiltersBar from "../../ReportFiltersBar";
import ReportExporter from "../../ReportExporter";

const ReportChart = dynamic(() => import("../../ReportChart"), {
  loading: () => <div style={{ height: 200, background: "var(--bg-muted)", borderRadius: 8 }} />,
  ssr: false,
});

interface ReportViewerClientProps {
  slug: string;
}

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style:    "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("en-IN");

export default function ReportViewerClient({ slug }: ReportViewerClientProps) {
  const definition = getReport(slug);

  const [data,        setData]       = useState<ReportResult | null>(null);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState<string | null>(null);
  const [filters,     setFilters]    = useState<Record<string, string>>({ preset: "this_month" });
  const [sortKey,     setSortKey]    = useState<string | null>(null);
  const [sortDir,     setSortDir]    = useState<"asc" | "desc">("desc");
  const [page,        setPage]       = useState(0);
  const [favorited,   setFavorited]  = useState(false);
  const PAGE_SIZE = 50;

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams(filters);
    try {
      const res = await fetch(`/api/reports/${slug}?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json);
      setPage(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug, filters]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Check favorite status
  useEffect(() => {
    fetch("/api/reports/favorites")
      .then((r) => r.json())
      .then((d) => setFavorited((d.favorites as string[]).includes(slug)));
  }, [slug]);

  const toggleFavorite = async () => {
    const res = await fetch("/api/reports/favorites", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ reportSlug: slug }),
    });
    const { favorited: fav } = await res.json();
    setFavorited(fav);
  };

  const sortedRows = data ? [...data.rows].sort((a, b) => {
    if (!sortKey) return 0;
    const av = (a as Record<string, unknown>)[sortKey];
    const bv = (b as Record<string, unknown>)[sortKey];
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "asc" ? av - bv : bv - av;
    }
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  }) : [];

  const pageRows = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  if (!definition) {
    return (
      <div style={{ padding: 32, color: "var(--text-muted)" }}>
        Report not found: <code>{slug}</code>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <Link
          href="/reports"
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        4,
            fontSize:   13,
            color:      "var(--text-muted)",
            textDecoration: "none",
          }}
        >
          <ChevronLeft size={14} /> Reports
        </Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {definition.name}
        </span>
      </div>

      <div
        style={{
          display:        "flex",
          alignItems:     "flex-start",
          justifyContent: "space-between",
          gap:            16,
          marginBottom:   20,
          flexWrap:       "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            {definition.name}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {definition.description}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={toggleFavorite}
            style={{
              display:    "flex", alignItems: "center", gap: 5,
              padding:    "7px 12px", borderRadius: 8,
              border:     "1px solid var(--border)",
              background: "var(--bg-surface)",
              cursor:     "pointer", fontSize: 12, color: "var(--text-secondary)",
            }}
          >
            <Star size={13} fill={favorited ? "var(--warning)" : "none"} color={favorited ? "var(--warning)" : "currentColor"} />
            {favorited ? "Favorited" : "Favorite"}
          </button>

          <button
            onClick={fetchReport}
            disabled={loading}
            style={{
              display:    "flex", alignItems: "center", gap: 5,
              padding:    "7px 12px", borderRadius: 8,
              border:     "1px solid var(--border)",
              background: "var(--bg-surface)",
              cursor:     loading ? "not-allowed" : "pointer",
              fontSize:   12, color: "var(--text-secondary)",
              opacity:    loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          {data && (
            <ReportExporter data={data} slug={slug} />
          )}
        </div>
      </div>

      {/* Filters */}
      <ReportFiltersBar filters={filters} onChange={setFilters} slug={slug} />

      {/* Error */}
      {error && (
        <div
          style={{
            background: "var(--danger-subtle)",
            border:     "1px solid var(--danger)",
            borderRadius: 8,
            padding:    "12px 16px",
            color:      "var(--danger)",
            fontSize:   13,
            marginTop:  16,
          }}
        >
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse" style={{ height: 80, borderRadius: 10, background: "var(--bg-muted)" }} />
            ))}
          </div>
          <div className="animate-pulse" style={{ height: 280, borderRadius: 10, background: "var(--bg-muted)" }} />
        </div>
      )}

      {/* Report content */}
      {!loading && data && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Summary cards */}
          {data.summary && (
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap:                 12,
                marginBottom:        24,
              }}
            >
              {Object.entries(data.summary).map(([key, value]) => (
                <SummaryCard key={key} label={key} value={value} />
              ))}
            </div>
          )}

          {/* Charts */}
          {data.charts && data.charts.length > 0 && (
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: data.charts.length === 1 ? "1fr" : "repeat(auto-fill, minmax(400px, 1fr))",
                gap:                 16,
                marginBottom:        24,
              }}
            >
              {data.charts.map((chart, ci) => (
                <div
                  key={ci}
                  style={{
                    background:   "var(--bg-surface)",
                    border:       "1px solid var(--border)",
                    borderRadius: 12,
                    padding:      "16px 20px",
                  }}
                >
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
                    {chart.title}
                  </h3>
                  <ReportChart chart={chart} />
                </div>
              ))}
            </div>
          )}

          {/* Data table */}
          <div
            style={{
              background:   "var(--bg-surface)",
              border:       "1px solid var(--border)",
              borderRadius: 12,
              overflow:     "hidden",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                padding:        "14px 20px",
                borderBottom:   "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {sortedRows.length.toLocaleString()} records
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Generated {new Date(data.generatedAt).toLocaleString("en-IN")}
              </span>
            </div>

            {/* Scrollable table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-muted)" }}>
                    {data.columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key, col.sortable)}
                        style={{
                          padding:      "10px 16px",
                          textAlign:    col.align ?? "left",
                          fontSize:     11,
                          fontWeight:   700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color:        "var(--text-muted)",
                          cursor:       col.sortable ? "pointer" : "default",
                          whiteSpace:   "nowrap",
                          userSelect:   "none",
                        }}
                      >
                        {col.label}
                        {sortKey === col.key && (
                          <span style={{ marginLeft: 4 }}>
                            {sortDir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, ri) => (
                    <tr
                      key={ri}
                      style={{
                        borderBottom:   "1px solid var(--border)",
                        transition:     "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--bg-muted)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      {data.columns.map((col) => (
                        <td
                          key={col.key}
                          style={{
                            padding:   "10px 16px",
                            textAlign: col.align ?? "left",
                            fontSize:  13,
                            color:     "var(--text-primary)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <CellValue
                            value={(row as Record<string, unknown>)[col.key]}
                            column={col}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Totals row */}
                  {data.totals && (
                    <tr
                      style={{
                        background:  "var(--bg-muted)",
                        borderTop:   "2px solid var(--border)",
                        fontWeight:  700,
                      }}
                    >
                      {data.columns.map((col, ci) => (
                        <td
                          key={col.key}
                          style={{
                            padding:   "10px 16px",
                            textAlign: col.align ?? "left",
                            fontSize:  13,
                            color:     "var(--text-primary)",
                          }}
                        >
                          {ci === 0
                            ? "Total"
                            : data.totals?.[col.key] !== undefined
                              ? CURRENCY_FORMATTER.format(data.totals[col.key] as number)
                              : ""}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  padding:        "12px 20px",
                  borderTop:      "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Page {page + 1} of {totalPages}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: "5px 10px", opacity: page === 0 ? 0.4 : 1 }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: "5px 10px", opacity: page >= totalPages - 1 ? 0.4 : 1 }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: unknown }) {
  const formattedLabel = label
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

  const isMonetary = label.toLowerCase().includes("revenue") ||
    label.toLowerCase().includes("amount") ||
    label.toLowerCase().includes("balance") ||
    label.toLowerCase().includes("profit") ||
    label.toLowerCase().includes("expenses") ||
    label.toLowerCase().includes("paid") ||
    label.toLowerCase().includes("outstanding") ||
    label.toLowerCase().includes("net") ||
    label.toLowerCase().includes("gross") ||
    label.toLowerCase().includes("operating");

  const formatted = typeof value === "number"
    ? isMonetary
      ? CURRENCY_FORMATTER.format(value)
      : value % 1 === 0
        ? NUMBER_FORMATTER.format(value)
        : value.toFixed(2)
    : typeof value === "boolean"
      ? value ? "✓ Balanced" : "✗ Imbalanced"
      : String(value ?? "—");

  return (
    <div
      style={{
        background:   "var(--bg-surface)",
        border:       "1px solid var(--border)",
        borderRadius: 10,
        padding:      "14px 16px",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
        {formattedLabel}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
        {formatted}
      </div>
    </div>
  );
}

// ── Cell Value ───────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  income:     { bg: "#d1fae5", color: "#059669" },
  expense:    { bg: "#fee2e2", color: "#dc2626" },
  inflow:     { bg: "#d1fae5", color: "#059669" },
  outflow:    { bg: "#fee2e2", color: "#dc2626" },
  PAID:       { bg: "#d1fae5", color: "#059669" },
  OVERDUE:    { bg: "#fee2e2", color: "#dc2626" },
  DRAFT:      { bg: "#f3f4f6", color: "#6b7280" },
  SENT:       { bg: "#dbeafe", color: "#2563eb" },
  PARTIAL:    { bg: "#fef3c7", color: "#d97706" },
  CREATE:     { bg: "#dbeafe", color: "#2563eb" },
  UPDATE:     { bg: "#fef3c7", color: "#d97706" },
  DELETE:     { bg: "#fee2e2", color: "#dc2626" },
  LOGIN:      { bg: "#f3f4f6", color: "#6b7280" },
  EXPORT:     { bg: "#ede9fe", color: "#7c3aed" },
  SETTINGS_CHANGE: { bg: "#fef3c7", color: "#d97706" },
  ASSET:      { bg: "#dbeafe", color: "#2563eb" },
  LIABILITY:  { bg: "#fee2e2", color: "#dc2626" },
  EQUITY:     { bg: "#ede9fe", color: "#7c3aed" },
  REVENUE:    { bg: "#d1fae5", color: "#059669" },
  EXPENSE:    { bg: "#fee2e2", color: "#dc2626" },
  DR:         { bg: "#dbeafe", color: "#2563eb" },
  CR:         { bg: "#d1fae5", color: "#059669" },
};

function CellValue({ value, column }: { value: unknown; column: ReportColumn }) {
  if (value === null || value === undefined) return <span style={{ color: "var(--text-muted)" }}>—</span>;

  switch (column.type) {
    case "currency":
      return (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {CURRENCY_FORMATTER.format(Number(value))}
        </span>
      );
    case "number":
      return (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {NUMBER_FORMATTER.format(Number(value))}
        </span>
      );
    case "percent":
      return <span>{Number(value).toFixed(2)}%</span>;
    case "date":
      return (
        <span>
          {value ? new Date(String(value)).toLocaleDateString("en-IN") : "—"}
        </span>
      );
    case "badge": {
      const str    = String(value);
      const colors = BADGE_COLORS[str] ?? { bg: "#f3f4f6", color: "#6b7280" };
      return (
        <span
          style={{
            display:      "inline-block",
            padding:      "2px 8px",
            borderRadius: 20,
            fontSize:     11,
            fontWeight:   600,
            background:   colors.bg,
            color:        colors.color,
          }}
        >
          {str}
        </span>
      );
    }
    default:
      return <span>{String(value)}</span>;
  }
}
