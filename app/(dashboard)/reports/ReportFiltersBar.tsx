"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

const DATE_PRESETS = [
  { value: "today",         label: "Today" },
  { value: "yesterday",     label: "Yesterday" },
  { value: "this_week",     label: "This Week" },
  { value: "last_week",     label: "Last Week" },
  { value: "this_month",    label: "This Month" },
  { value: "last_month",    label: "Last Month" },
  { value: "this_quarter",  label: "This Quarter" },
  { value: "last_quarter",  label: "Last Quarter" },
  { value: "this_year",     label: "This Year" },
  { value: "last_year",     label: "Last Year" },
  { value: "custom",        label: "Custom Range" },
];

interface ReportFiltersBarProps {
  filters:  Record<string, string>;
  onChange: (f: Record<string, string>) => void;
  slug:     string;
}

export default function ReportFiltersBar({ filters, onChange, slug }: ReportFiltersBarProps) {
  const preset   = filters.preset ?? "this_month";
  const isCustom = preset === "custom";

  const setPreset = (p: string) => {
    onChange({ ...filters, preset: p });
  };

  const setCustom = (key: "startDate" | "endDate", value: string) => {
    onChange({ ...filters, preset: "custom", [key]: value });
  };

  return (
    <div
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        10,
        flexWrap:   "wrap",
        marginBottom: 20,
        padding:    "12px 16px",
        background: "var(--bg-surface)",
        border:     "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <CalendarDays size={15} color="var(--text-muted)" />

      {/* Preset selector */}
      <div style={{ position: "relative" }}>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          style={{
            appearance:  "none",
            background:  "var(--bg-muted)",
            border:      "1px solid var(--border)",
            borderRadius: 7,
            padding:     "6px 28px 6px 10px",
            fontSize:    13,
            cursor:      "pointer",
            color:       "var(--text-primary)",
            outline:     "none",
          }}
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <ChevronDown
          size={13}
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          color="var(--text-muted)"
        />
      </div>

      {/* Custom range inputs */}
      {isCustom && (
        <>
          <input
            type="date"
            value={filters.startDate ?? ""}
            onChange={(e) => setCustom("startDate", e.target.value)}
            style={dateInputStyle}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
          <input
            type="date"
            value={filters.endDate ?? ""}
            onChange={(e) => setCustom("endDate", e.target.value)}
            style={dateInputStyle}
          />
        </>
      )}
    </div>
  );
}

const dateInputStyle: React.CSSProperties = {
  background:  "var(--bg-muted)",
  border:      "1px solid var(--border)",
  borderRadius: 7,
  padding:     "6px 10px",
  fontSize:    13,
  color:       "var(--text-primary)",
  outline:     "none",
};
