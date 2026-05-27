"use client";

// ============================================================
// FinRP — Onboarding Step Layout
// Progress bar + branded wrapper used by every wizard step.
// ============================================================

import { motion } from "framer-motion";
import { Check, Zap } from "lucide-react";
import { ONBOARDING_STEPS } from "@/types/onboarding";

interface StepLayoutProps {
  currentStep: number;
  totalSteps: number;
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export function StepLayout({
  currentStep,
  totalSteps,
  children,
  title,
  subtitle,
}: StepLayoutProps) {
  const progressPct = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px 48px",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "fixed",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 600,
          background:
            "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ width: "100%", maxWidth: 680, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              background: "linear-gradient(135deg, #6366f1, #10b981)",
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={16} color="white" />
          </div>
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              background: "linear-gradient(135deg, #818cf8, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            FinRP
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
          {/* Numeric step pills — shown on md+ */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 12,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {ONBOARDING_STEPS.map((s, idx) => {
              const isCompleted = s.id < currentStep;
              const isActive = s.id === currentStep;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      minWidth: 56,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        transition: "all 0.2s ease",
                        background: isCompleted
                          ? "linear-gradient(135deg, #10b981, #059669)"
                          : isActive
                          ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                          : "var(--bg-elevated)",
                        border: `1.5px solid ${
                          isCompleted
                            ? "#10b981"
                            : isActive
                            ? "#6366f1"
                            : "var(--border)"
                        }`,
                        color: isCompleted || isActive ? "white" : "var(--text-muted)",
                      }}
                    >
                      {isCompleted ? <Check size={13} strokeWidth={3} /> : s.id}
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive
                          ? "var(--text-primary)"
                          : isCompleted
                          ? "var(--accent-500)"
                          : "var(--text-muted)",
                        whiteSpace: "nowrap",
                        letterSpacing: "0.01em",
                      }}
                    >
                      {s.title}
                    </span>
                  </div>
                  {idx < ONBOARDING_STEPS.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        borderRadius: 2,
                        minWidth: 12,
                        background: isCompleted
                          ? "linear-gradient(90deg, #10b981, #6366f1)"
                          : "var(--border)",
                        transition: "background 0.3s ease",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Linear progress bar */}
          <div
            style={{
              height: 4,
              background: "var(--bg-elevated)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              style={{
                height: "100%",
                background: "linear-gradient(90deg, #6366f1, #10b981)",
                borderRadius: 4,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              Step {currentStep} of {totalSteps}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {Math.round(progressPct)}% complete
            </span>
          </div>
        </div>

        {/* Card */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: 20,
            padding: "36px 40px",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Step header */}
          <div style={{ marginBottom: 28 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--brand-400)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {subtitle}
            </p>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
              }}
            >
              {title}
            </h1>
          </div>

          {/* Step content */}
          {children}
        </motion.div>
      </div>
    </div>
  );
}
