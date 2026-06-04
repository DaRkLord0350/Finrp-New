import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
  change?: string;
  changePositive?: boolean;
  className?: string;
}

export function MetricCard({ label, value, icon, color = "#6366f1", change, changePositive, className }: MetricCardProps) {
  return (
    <div
      className={cn(className)}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "20px 24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        {icon && (
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
            {icon}
          </div>
        )}
        {change && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: changePositive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: changePositive ? "#10b981" : "#ef4444" }}>
            {change}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
