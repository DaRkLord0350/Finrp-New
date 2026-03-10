"use client";

import { motion } from "framer-motion";
import {
  Users,
  FileText,
  ShieldCheck,
  Package,
  BarChart3,
  Bot,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Customer Management",
    description:
      "Centralize customer profiles, track relationships, manage contacts, and monitor engagement across your entire client base.",
    color: "#10b981",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.2)",
  },
  {
    icon: FileText,
    title: "Billing & Invoicing",
    description:
      "Generate professional invoices, track payments, manage billing cycles, and get notified about overdue accounts automatically.",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.1)",
    border: "rgba(99,102,241,0.2)",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Tracking",
    description:
      "Stay ahead of regulatory requirements with compliance task management, deadline tracking, and automated audit trails.",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.2)",
  },
  {
    icon: Package,
    title: "Inventory Management",
    description:
      "Monitor stock levels in real time, receive low-stock alerts, and manage your full product catalog from one place.",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.1)",
    border: "rgba(59,130,246,0.2)",
  },
  {
    icon: BarChart3,
    title: "Financial Analytics",
    description:
      "Visualize revenue trends, track key metrics, forecast cash flow, and make data-driven decisions with powerful charts.",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.1)",
    border: "rgba(139,92,246,0.2)",
  },
  {
    icon: Bot,
    title: "AI Financial Insights",
    description:
      "Get personalized financial advice, anomaly detection, and strategic recommendations powered by Gemini AI.",
    color: "#ec4899",
    bg: "rgba(236,72,153,0.1)",
    border: "rgba(236,72,153,0.2)",
  },
];

export default function FeatureSection() {
  return (
    <section
      id="features"
      style={{
        padding: "80px 24px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: "center", marginBottom: 56 }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--brand-400)",
            marginBottom: 12,
          }}
        >
          Everything you need
        </p>
        <h2
          style={{
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            lineHeight: 1.15,
            marginBottom: 16,
          }}
        >
          One platform for your entire{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #818cf8, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            financial stack
          </span>
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            maxWidth: 500,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Stop juggling dozens of tools. FinRP brings every critical business
          function under one roof.
        </p>
      </motion.div>

      {/* Feature grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: "24px 26px",
                cursor: "default",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = feature.border;
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${feature.bg}`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: feature.bg,
                  border: `1px solid ${feature.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Icon size={20} color={feature.color} />
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: 8,
                  letterSpacing: "-0.01em",
                }}
              >
                {feature.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                {feature.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
