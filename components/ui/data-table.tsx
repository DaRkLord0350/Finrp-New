"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
};

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage = "No data",
  onRowClick,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn(className)} style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={{
                  textAlign: col.align ?? "left",
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 14 }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: "1px solid var(--border)",
                  cursor: onRowClick ? "pointer" : undefined,
                  transition: "background 0.1s",
                }}
                onMouseOver={(e) => { if (onRowClick) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                onMouseOut={(e) => { if (onRowClick) e.currentTarget.style.background = ""; }}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    style={{
                      padding: "12px",
                      fontSize: 13,
                      color: "var(--text-primary)",
                      textAlign: col.align ?? "left",
                    }}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key as string] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
