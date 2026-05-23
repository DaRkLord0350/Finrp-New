"use client";

import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: "up" | "down";
  icon?: React.ReactNode;
  description?: string;
}

export function MetricCard({
  title,
  value,
  change,
  trend,
  icon,
  description,
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border bg-background p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {title}
          </p>

          <h2 className="text-3xl font-bold tracking-tight">
            {value}
          </h2>

          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-muted p-3">
          {icon}
        </div>
      </div>

      {change !== undefined && (
        <div
          className={cn(
            "mt-4 flex items-center gap-1 text-sm font-medium",
            trend === "up"
              ? "text-green-600"
              : "text-red-600"
          )}
        >
          {trend === "up" ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}

          <span>{change}%</span>
        </div>
      )}
    </div>
  );
}