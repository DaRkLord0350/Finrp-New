"use client";

import { motion } from "framer-motion";
import {
  DollarSign,
  Users,
  FileText,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

export default function ProductPreview() {
  return (
    <section
      style={{
        padding: "40px 24px 80px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55 }}
        style={{ textAlign: "center", marginBottom: 48 }}
      >
        <h2
          style={{
            fontSize: "clamp(24px, 3.5vw, 38px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          Everything at a glance
        </h2>
        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
          A dashboard designed for clarity, speed, and action.
        </p>
      </motion.div>

      {/* Mock Dashboard Preview */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* Fake topbar */}
        <div
          style={{
            background: "rgba(9,9,11,0.9)",
            borderBottom: "1px solid var(--border)",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {["#ef4444", "#f59e0b", "#10b981"].map((c) => (
              <div
                key={c}
                style={{ width: 10, height: 10, borderRadius: "50%", background: c }}
              />
            ))}
          </div>
          <div
            style={{
              flex: 1,
              height: 24,
              background: "var(--bg-elevated)",
              borderRadius: 6,
              maxWidth: 320,
              display: "flex",
              alignItems: "center",
              paddingLeft: 10,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              app.finrp.io/dashboard
            </span>
          </div>
        </div>

        {/* Fake dashboard body */}
        <div style={{ display: "flex", height: 420 }}>
          {/* Fake sidebar */}
          <div
            style={{
              width: 160,
              background: "var(--bg-surface)",
              borderRight: "1px solid var(--border)",
              padding: "16px 10px",
              flexShrink: 0,
            }}
          >
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, paddingLeft: 4 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg, #6366f1, #10b981)" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#818cf8" }}>FinRP</span>
            </div>
            {[
              { label: "Dashboard", icon: BarChart3, active: true },
              { label: "CRM", icon: Users, active: false },
              { label: "Billing", icon: FileText, active: false },
              { label: "Items", icon: FileText, active: false },
              { label: "Compliance", icon: ShieldCheck, active: false },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 8,
                    background: item.active ? "rgba(99,102,241,0.12)" : "transparent",
                    color: item.active ? "#818cf8" : "var(--text-muted)",
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 2,
                  }}
                >
                  <Icon size={12} />
                  {item.label}
                </div>
              );
            })}
          </div>

          {/* Fake main content */}
          <div style={{ flex: 1, padding: "20px 24px", overflowY: "hidden" }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
              Good morning 👋
            </p>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Revenue", value: "$51,200", color: "#6366f1", icon: DollarSign },
                { label: "Customers", value: "124", color: "#10b981", icon: Users },
                { label: "Invoices", value: "39", color: "#3b82f6", icon: FileText },
                { label: "Overdue", value: "5", color: "#f59e0b", icon: ShieldCheck },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.label}</p>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: `${s.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={10} color={s.color} />
                      </div>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</p>
                  </div>
                );
              })}
            </div>

            {/* Chart placeholder */}
            <div
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "14px 16px",
                height: 180,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Revenue Trend</p>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#10b981" }}>
                  <TrendingUp size={10} />
                  +13.2%
                </div>
              </div>
              {/* Fake bar chart */}
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 5 }}>
                {[45, 62, 38, 75, 55, 88, 70, 92, 65, 80, 95, 82].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      borderRadius: "3px 3px 0 0",
                      background: i === 11
                        ? "linear-gradient(180deg, #6366f1, #4f46e5)"
                        : "rgba(99,102,241,0.25)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Arrow indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.4 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginTop: 28,
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        This is your dashboard
        <ArrowRight size={13} />
      </motion.div>
    </section>
  );
}
