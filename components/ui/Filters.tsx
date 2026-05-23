// ============================================================
// components/ui/Filters.tsx
// Generic filter bar — renders a row of select dropdowns + date pickers.
// ============================================================
"use client";

import { Filter } from "lucide-react";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterField {
  key: string;
  label: string;
  type: "select" | "date";
  options?: FilterOption[];  // for type === "select"
  value: string;
  onChange: (value: string) => void;
}

interface FiltersProps {
  fields: FilterField[];
  onClear?: () => void;
  className?: string;
}

const inputStyle: React.CSSProperties = {
  padding: "7px 12px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  cursor: "pointer",
};

export function Filters({ fields, onClear, className = "" }: FiltersProps) {
  const hasActive = fields.some((f) => f.value !== "" && f.value !== "all");

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      style={{ rowGap: 8 }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        <Filter size={14} />
        Filter:
      </span>

      {fields.map((field) =>
        field.type === "select" ? (
          <select
            key={field.key}
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            style={inputStyle}
          >
            <option value="all">{field.label}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            key={field.key}
            type="date"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            style={inputStyle}
            title={field.label}
          />
        )
      )}

      {hasActive && onClear && (
        <button
          onClick={onClear}
          style={{
            fontSize: 12,
            color: "var(--accent)",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
