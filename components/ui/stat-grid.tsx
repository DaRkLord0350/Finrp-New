import type { ReactNode } from "react";
import { MetricCard } from "./metric-card";

export type StatItem = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  change?: string;
  changePositive?: boolean;
};

interface StatGridProps {
  stats: StatItem[];
  columns?: number;
}

export function StatGrid({ stats, columns = 4 }: StatGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${Math.floor(100 / columns) - 5}%, 1fr))`,
        gap: 16,
        marginBottom: 32,
      }}
    >
      {stats.map((stat) => (
        <MetricCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
