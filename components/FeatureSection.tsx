"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  Users,
  ClipboardList,
  FolderOpen,
  BarChart3,
  FileText,
  Bot,
  Globe,
  Building2,
  Briefcase,
} from "lucide-react";

const caFeatures = [
  {
    icon: ShieldCheck,
    title: "Compliance Automation",
    description:
      "Auto-track GST, ITR, and TDS deadlines. Set rules, receive alerts, and keep every client's compliance calendar updated without manual effort.",
    color: "#818cf8",
    bg: "rgba(129,140,248,0.1)",
    border: "rgba(129,140,248,0.22)",
  },
  {
    icon: Users,
    title: "Client Management",
    description:
      "Maintain complete client profiles — status, documents, assignments, and communication history — in one searchable interface.",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.1)",
    border: "rgba(167,139,250,0.22)",
  },
  {
    icon: ClipboardList,
    title: "Team Work Allocation",
    description:
      "Distribute tasks by team capacity, track workloads, and monitor progress to prevent bottlenecks at peak filing season.",
    color: "#c4b5fd",
    bg: "rgba(196,181,253,0.1)",
    border: "rgba(196,181,253,0.22)",
  },
  {
    icon: FolderOpen,
    title: "Document Collection",
    description:
      "Send document requests, track submission status, receive files securely, and route through approval workflows — all in one place.",
    color: "#ddd6fe",
    bg: "rgba(221,214,254,0.08)",
    border: "rgba(221,214,254,0.18)",
  },
];

const clientFeatures = [
  {
    icon: BarChart3,
    title: "Financial Dashboard",
    description:
      "Live P&L, cash position, outstanding dues, and key ratios — presented in a clear, actionable dashboard you actually understand.",
    color: "#34d399",
    bg: "rgba(52,211,153,0.1)",
    border: "rgba(52,211,153,0.22)",
  },
  {
    icon: FileText,
    title: "Tax & Filing Tracking",
    description:
      "Always know the status of your ITR, GST returns, TDS filings, and other obligations. No more chasing your CA for updates.",
    color: "#6ee7b7",
    bg: "rgba(110,231,183,0.1)",
    border: "rgba(110,231,183,0.22)",
  },
  {
    icon: Bot,
    title: "AI Insights",
    description:
      "Surface anomalies, forecast cash flow, and get strategic recommendations powered by Gemini AI — built into your financial view.",
    color: "#a7f3d0",
    bg: "rgba(167,243,208,0.08)",
    border: "rgba(167,243,208,0.18)",
  },
  {
    icon: Globe,
    title: "Integrations",
    description:
      "Connect Tally, Zoho Books, and M1xchange TReDS. FinRP speaks the tools your business already uses — without disrupting your workflow.",
    color: "#d1fae5",
    bg: "rgba(209,250,229,0.06)",
    border: "rgba(209,250,229,0.14)",
  },
];

type Feature = (typeof caFeatures)[0];

function FeatureCard({ feature, delay }: { feature: Feature; delay: number }) {
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2 }}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "18px 20px",
        cursor: "default",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = feature.border;
        e.currentTarget.style.boxShadow = `0 4px 20px ${feature.bg}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: feature.bg,
          border: `1px solid ${feature.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Icon size={17} color={feature.color} />
      </div>
      <h4
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 6,
          letterSpacing: "-0.01em",
        }}
      >
        {feature.title}
      </h4>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {feature.description}
      </p>
    </motion.div>
  );
}

function Panel({
  persona,
  title,
  description,
  features,
  accentColor,
  accentBg,
  accentBorder,
  delay,
}: {
  persona: "ca" | "business";
  title: string;
  description: string;
  features: Feature[];
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay }}
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${accentBorder}`,
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      {/* Accent top bar */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />

      {/* Panel header */}
      <div style={{ padding: "28px 28px 20px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 99,
            background: accentBg,
            border: `1px solid ${accentBorder}`,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            color: accentColor,
            marginBottom: 14,
          }}
        >
          {persona === "ca" ? <Building2 size={11} /> : <Briefcase size={11} />}
          {persona === "ca" ? "For CA Firms & Practices" : "For Businesses & Clients"}
        </div>
        <h3
          style={{
            fontSize: "clamp(18px, 2.2vw, 24px)",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.03em",
            marginBottom: 8,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {description}
        </p>
      </div>

      {/* Cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
          padding: "0 20px 24px",
        }}
      >
        {features.map((f, i) => (
          <FeatureCard key={f.title} feature={f} delay={delay + 0.08 + i * 0.06} />
        ))}
      </div>
    </motion.div>
  );
}

export default function FeatureSection() {
  return (
    <section
      id="features"
      style={{ padding: "72px 24px 80px", maxWidth: 1280, margin: "0 auto" }}
    >
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: "center", marginBottom: 52 }}
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
          Platform
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
          One platform,{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #818cf8, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            two worlds
          </span>
        </h2>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            maxWidth: 520,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          FinRP is purpose-built for the CA ecosystem — serving practices and their clients
          with dedicated, role-specific functionality.
        </p>
      </motion.div>

      {/* Split panels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))",
          gap: 24,
        }}
      >
        <Panel
          persona="ca"
          title="Why CA Firms Choose FinRP"
          description="Streamline your entire practice — from client onboarding to final filing — with tools purpose-built for chartered accountants."
          features={caFeatures}
          accentColor="#818cf8"
          accentBg="rgba(129,140,248,0.1)"
          accentBorder="rgba(129,140,248,0.2)"
          delay={0.1}
        />
        <Panel
          persona="business"
          title="Why Businesses Use FinRP"
          description="Stay on top of your financials and compliance without the confusion. Your CA works in FinRP — so should you."
          features={clientFeatures}
          accentColor="#34d399"
          accentBg="rgba(52,211,153,0.1)"
          accentBorder="rgba(52,211,153,0.2)"
          delay={0.2}
        />
      </div>
    </section>
  );
}
