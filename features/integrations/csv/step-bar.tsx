"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { STEP_CONFIG } from "./entity-types";
import type { WizardStep } from "./types";

export function StepBar({ current }: { current: WizardStep }) {
  const currentIdx = STEP_CONFIG.findIndex((s) => s.id === current);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ height: 3, background: "var(--bg-elevated)", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${(currentIdx / (STEP_CONFIG.length - 1)) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          style={{ height: "100%", background: "linear-gradient(90deg, #3b82f6, #06b6d4)", borderRadius: 3 }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {STEP_CONFIG.map((s, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx;
          return (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s",
                background: isDone ? "linear-gradient(135deg, #3b82f6, #06b6d4)" : isActive ? "#3b82f615" : "var(--bg-elevated)",
                border: isActive ? "2px solid #3b82f6" : isDone ? "none" : "2px solid var(--border)",
                boxShadow: isActive ? "0 0 0 3px #3b82f615" : "none",
              }}>
                {isDone ? (
                  <CheckCircle2 size={13} color="white" />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? "#3b82f6" : "var(--text-muted)" }}>{i + 1}</span>
                )}
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color: isActive ? "#3b82f6" : isDone ? "var(--text-secondary)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
