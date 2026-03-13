"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface CashFlowItem {
  label: string;
  amount: number;
}

interface CashFlowAnalysisProps {
  inflows: CashFlowItem[];
  outflows: CashFlowItem[];
  netCashFlow: number;
}

export default function CashFlowAnalysis({ inflows, outflows, netCashFlow }: CashFlowAnalysisProps) {
  const totalInflows = inflows.reduce((sum, item) => sum + item.amount, 0);
  const totalOutflows = outflows.reduce((sum, item) => sum + item.amount, 0);

  const CashFlowColumn = ({
    title,
    icon: Icon,
    items,
    total,
    color,
    delay,
  }: {
    title: string;
    icon: React.ReactNode;
    items: CashFlowItem[];
    total: number;
    color: string;
    delay: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <div style={{ color, fontSize: 20 }}>{Icon}</div>
        <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h4>
      </div>

      <div style={{ marginBottom: 16 }}>
        {items.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + idx * 0.05 }}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 12,
              marginBottom: 12,
              borderBottom: idx < items.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.label}</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              ₹{(item.amount / 1000).toFixed(0)}K
            </p>
          </motion.div>
        ))}
      </div>

      <div
        style={{
          padding: "14px 16px",
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-md)",
          borderLeft: `3px solid ${color}`,
        }}
      >
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Total {title}
        </p>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
          ₹{(total / 1000).toFixed(0)}K
        </p>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      className="section-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <div style={{ marginBottom: 28 }}>
        <h3 className="section-title">Cash Flow Analysis</h3>
        <p className="section-subtitle">Monthly financial inflows and outflows summary</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <CashFlowColumn
          title="Monthly Inflows"
          icon={<TrendingUp size={20} />}
          items={inflows}
          total={totalInflows}
          color="#10b981"
          delay={0.55}
        />
        <CashFlowColumn
          title="Monthly Outflows"
          icon={<TrendingDown size={20} />}
          items={outflows}
          total={totalOutflows}
          color="#ef4444"
          delay={0.6}
        />
      </div>

      {/* Net Cash Flow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.65 }}
        style={{
          background: "linear-gradient(135deg, #6366f1, #a78bfa)",
          borderRadius: "var(--radius-lg)",
          padding: 32,
          textAlign: "center",
          color: "#ffffff",
        }}
      >
        <p style={{ fontSize: 12, marginBottom: 8, opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Net Cash Flow
        </p>
        <p style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>
          ₹{(netCashFlow / 1000).toFixed(0)}K
        </p>
        <p style={{ fontSize: 12, opacity: 0.85 }}>
          {netCashFlow > 0 ? "Positive cash flow for the month" : "Negative cash flow for the month"}
        </p>
      </motion.div>
    </motion.div>
  );
}
