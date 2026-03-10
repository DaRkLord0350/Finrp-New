"use client";

import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  index?: number;
}

export default function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "#6366f1",
  index = 0,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: "easeOut" }}
    >
      {/* Top row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {title}
        </p>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${iconColor}18`,
            border: `1px solid ${iconColor}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={iconColor} strokeWidth={1.75} />
        </div>
      </div>

      {/* Value */}
      <p
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
          marginBottom: 10,
        }}
      >
        {value}
      </p>

      {/* Change indicator */}
      {change !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              fontSize: 12,
              fontWeight: 600,
              color: isPositive
                ? "#10b981"
                : isNegative
                ? "#ef4444"
                : "var(--text-muted)",
            }}
          >
            {isPositive ? (
              <TrendingUp size={13} />
            ) : isNegative ? (
              <TrendingDown size={13} />
            ) : (
              <Minus size={13} />
            )}
            {Math.abs(change)}%
          </span>
          {changeLabel && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {changeLabel}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
