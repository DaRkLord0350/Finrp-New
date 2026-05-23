// ============================================================
// components/charts/Charts.tsx
// Reusable chart components built on Recharts.
// ============================================================
"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { formatCompactCurrency } from "@/lib/formatters/currency";

// ---------------------------------------------------------------------------
// Shared palette
// ---------------------------------------------------------------------------
export const CHART_COLORS = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#ec4899", // pink
  "#14b8a6", // teal
  "#8b5cf6", // violet
  "#f97316", // orange
];

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      {label && (
        <p style={{ color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", color: entry.color }}>
          <span style={{ fontWeight: 500 }}>{entry.name}:</span>
          <span>{typeof entry.value === "number" ? formatCompactCurrency(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AreaChartCard
// ---------------------------------------------------------------------------
interface DataPoint {
  label: string;
  [key: string]: string | number;
}

interface AreaChartCardProps {
  data: DataPoint[];
  dataKeys: string[];
  height?: number;
  colors?: string[];
  currency?: boolean;
}

export function AreaChartCard({
  data,
  dataKeys,
  height = 220,
  colors = CHART_COLORS,
  currency = true,
}: AreaChartCardProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          {dataKeys.map((key, i) => (
            <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.25} />
              <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => currency ? formatCompactCurrency(v) : v}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {dataKeys.map((key, i) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            fill={`url(#grad-${key})`}
            dot={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// BarChartCard
// ---------------------------------------------------------------------------
interface BarChartCardProps {
  data: DataPoint[];
  dataKeys: string[];
  height?: number;
  colors?: string[];
  currency?: boolean;
  stacked?: boolean;
}

export function BarChartCard({
  data,
  dataKeys,
  height = 220,
  colors = CHART_COLORS,
  currency = true,
  stacked = false,
}: BarChartCardProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => currency ? formatCompactCurrency(v) : v}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {dataKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[i % colors.length]}
            radius={[4, 4, 0, 0]}
            stackId={stacked ? "stack" : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// LineChartCard
// ---------------------------------------------------------------------------
interface LineChartCardProps {
  data: DataPoint[];
  dataKeys: string[];
  height?: number;
  colors?: string[];
  currency?: boolean;
}

export function LineChartCard({
  data,
  dataKeys,
  height = 220,
  colors = CHART_COLORS,
  currency = true,
}: LineChartCardProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => currency ? formatCompactCurrency(v) : v}
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {dataKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// DonutChart
// ---------------------------------------------------------------------------
interface DonutChartProps {
  data: { label: string; value: number }[];
  height?: number;
  colors?: string[];
  currency?: boolean;
}

export function DonutChart({ data, height = 220, colors = CHART_COLORS, currency = false }: DonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="75%"
          dataKey="value"
          nameKey="label"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => [currency ? formatCompactCurrency(v) : v, ""]}
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
