"use client";

import { motion } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";

interface LoanProduct {
  id: string;
  name: string;
  tag: string;
  interestRateMin: number;
  interestRateMax: number;
  maxAmount: number;
  processingFee: number;
  bank: string;
}

interface LoanRecommendationsProps {
  products: LoanProduct[];
  onApply?: (id: string) => void;
}

const tagConfig: Record<string, { bg: string; text: string }> = {
  Recommended: { bg: "rgba(99, 102, 241, 0.1)", text: "#6366f1" },
  Popular: { bg: "rgba(16, 185, 129, 0.1)", text: "#10b981" },
  "Fast Approval": { bg: "rgba(251, 146, 60, 0.1)", text: "#ea580c" },
};

export default function LoanRecommendations({ products, onApply }: LoanRecommendationsProps) {
  return (
    <motion.div
      className="section-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div style={{ marginBottom: 24 }}>
        <h3 className="section-title">Recommended Loan Products</h3>
        <p className="section-subtitle">Best loan products tailored for your business</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
        {products.map((product, idx) => {
          const tagStyle = tagConfig[product.tag] || { bg: "rgba(99, 102, 241, 0.1)", text: "#6366f1" };
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-lg)",
                padding: 24,
                position: "relative",
                transition: "all 0.3s ease",
                overflow: "hidden",
              }}
              className="hover:border-brand-400 hover:shadow-lg"
            >
              {/* Accent bar */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: "linear-gradient(90deg, #6366f1, #a78bfa)",
                }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    {product.name}
                  </h4>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{product.bank}</p>
                </div>
                <div
                  style={{
                    background: tagStyle.bg,
                    color: tagStyle.text,
                    padding: "6px 12px",
                    borderRadius: "var(--radius-md)",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Star size={12} fill="currentColor" />
                  {product.tag}
                </div>
              </div>

              <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Interest Rate Range</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                  {product.interestRateMin}% - {product.interestRateMax}%
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Max Amount
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                    ₹{(product.maxAmount / 100000).toFixed(0)}L
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Processing Fee
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                    {product.processingFee}%
                  </p>
                </div>
              </div>

              <button
                onClick={() => onApply?.(product.id)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#6366f1",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#4f46e5";
                  (e.currentTarget as HTMLElement).style.gap = "12px";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#6366f1";
                  (e.currentTarget as HTMLElement).style.gap = "8px";
                }}
              >
                Apply Now
                <ArrowRight size={14} />
              </button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
