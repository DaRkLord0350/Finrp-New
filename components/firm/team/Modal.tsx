"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 520,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
        backdropFilter: "blur(2px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
            {subtitle && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Shared field styles (match the existing dark theme) ──────────
export const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: 6,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

export const fieldGap: CSSProperties = { marginBottom: 16 };

export function primaryBtnStyle(disabled: boolean, flex = 2): CSSProperties {
  return {
    flex,
    padding: "10px",
    background: disabled ? "var(--bg-overlay)" : "#6366f1",
    color: disabled ? "var(--text-muted)" : "white",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

export const secondaryBtnStyle: CSSProperties = {
  flex: 1,
  padding: "10px",
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
  cursor: "pointer",
};
