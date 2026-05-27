"use client";

// ============================================================
// Step 1 — Welcome
// ============================================================

import { motion } from "framer-motion";
import { ArrowRight, BarChart3, FileText, Users, Zap } from "lucide-react";

interface WelcomeStepProps {
  onNext: () => void;
}

const features = [
  { icon: FileText, label: "Smart Invoicing", color: "#6366f1" },
  { icon: Users, label: "CRM & Leads", color: "#10b981" },
  { icon: BarChart3, label: "Analytics", color: "#f59e0b" },
  { icon: Zap, label: "AI Advisor", color: "#ec4899" },
];

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div>
      {/* Hero icon */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.15))",
            border: "1.5px solid rgba(99,102,241,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Zap size={40} color="#818cf8" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: 10,
          }}
        >
          Welcome to FinRP
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          style={{
            fontSize: 15,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          Let&apos;s set up your organization. This takes{" "}
          <strong style={{ color: "var(--accent-500)" }}>less than 2 minutes</strong> and
          you can always update it later.
        </motion.p>
      </div>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 32,
        }}
      >
        {features.map(({ icon: Icon, label, color }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: "var(--bg-elevated)",
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${color}18`,
                border: `1px solid ${color}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={15} color={color} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {label}
            </span>
          </div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        onClick={onNext}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "14px 24px",
          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
          border: "none",
          borderRadius: 12,
          color: "white",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
        }}
      >
        Start Setup
        <ArrowRight size={17} />
      </motion.button>
    </div>
  );
}
