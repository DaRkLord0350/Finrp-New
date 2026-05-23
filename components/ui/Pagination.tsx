// ============================================================
// components/ui/Pagination.tsx
// ============================================================
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: disabled ? "transparent" : "var(--bg-card)",
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    fontSize: 13,
  });

  const pageBtn = (p: number, current: boolean): React.CSSProperties => ({
    minWidth: 32,
    height: 32,
    borderRadius: 6,
    border: current ? "1px solid var(--accent)" : "1px solid var(--border)",
    background: current ? "var(--accent)" : "var(--bg-card)",
    color: current ? "#fff" : "var(--text-primary)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: current ? 600 : 400,
  });

  // Compute page range to show
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "12px 0",
      }}
    >
      {/* Count */}
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
        {total === 0 ? "No results" : `Showing ${start}–${end} of ${total}`}
      </span>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Page size */}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            style={{
              padding: "5px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        )}

        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          style={btnStyle(page === 1)}
        >
          <ChevronLeft size={15} />
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} style={{ color: "var(--text-muted)", fontSize: 13 }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              style={pageBtn(p as number, p === page)}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          style={btnStyle(page === totalPages)}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
