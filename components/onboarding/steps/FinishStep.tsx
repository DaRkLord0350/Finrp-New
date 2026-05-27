"use client";

// ============================================================
// Step 8 — Finish / Complete
// ============================================================

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, CheckCircle2, BarChart3, FileText, Users, Zap } from "lucide-react";

interface FinishStepProps {
  orgName: string;
  enabledModules: string[];
  onComplete: () => Promise<void>;
  isLoading: boolean;
}

const MODULE_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  CRM: Users,
  BILLING: FileText,
  ACCOUNTING: BarChart3,
  INVENTORY: Zap,
  HR: Users,
  ANALYTICS: BarChart3,
};

export function FinishStep({ orgName, enabledModules, onComplete, isLoading }: FinishStepProps) {
  const [completing, setCompleting] = useState(false);

  async function handleComplete() {
    setCompleting(true);
    await onComplete();
    // redirect happens in wizard after this resolves
  }

  return (
    <div style={{ textAlign: "center" }}>
      {/* Success animation */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut", type: "spring", stiffness: 200 }}
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(99,102,241,0.15))",
          border: "2px solid rgba(16,185,129,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}
      >
        <CheckCircle2 size={40} color="#10b981" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.025em",
            marginBottom: 8,
          }}
        >
          You&apos;re all set!
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
          {orgName ? (
            <>
              <strong style={{ color: "var(--text-primary)" }}>{orgName}</strong> is ready. Your
              workspace has been configured and you&apos;re ready to go.
            </>
          ) : (
            "Your workspace has been configured and you're ready to go."
          )}
        </p>
      </motion.div>

      {/* Modules summary */}
      {enabledModules.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 24,
            textAlign: "left",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Enabled modules ({enabledModules.length})
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {enabledModules.map((mod) => {
              const Icon = MODULE_ICONS[mod] ?? Zap;
              return (
                <div
                  key={mod}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 20,
                  }}
                >
                  <Icon size={11} color="#818cf8" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#818cf8" }}>
                    {mod.charAt(0) + mod.slice(1).toLowerCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* What's next */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        style={{ marginBottom: 28 }}
      >
        {[
          "Explore your dashboard with live KPIs",
          "Create your first invoice in Billing",
          "Add customers and track leads in CRM",
          "Set up compliance tasks and reminders",
        ].map((item, idx) => (
          <div
            key={item}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              borderBottom: idx < 3 ? "1px solid var(--border)" : "none",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1, #10b981)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 800,
                color: "white",
              }}
            >
              {idx + 1}
            </div>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "left" }}>
              {item}
            </span>
          </div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.3 }}
        type="button"
        onClick={handleComplete}
        disabled={completing || isLoading}
        whileHover={{ scale: completing ? 1 : 1.02 }}
        whileTap={{ scale: completing ? 1 : 0.98 }}
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
          fontWeight: 700,
          cursor: completing ? "not-allowed" : "pointer",
          opacity: completing ? 0.75 : 1,
          boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
        }}
      >
        {completing ? <Loader2 size={17} className="animate-spin" /> : null}
        {completing ? "Setting up your workspace..." : "Go to Dashboard"}
        {!completing && <ArrowRight size={17} />}
      </motion.button>
    </div>
  );
}
