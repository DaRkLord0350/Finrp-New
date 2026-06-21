"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Briefcase,
  Sparkles,
  Workflow,
  LayoutDashboard,
  Boxes,
  Bot,
  Landmark,
  ShieldCheck,
  ReceiptText,
  Users,
} from "lucide-react";

type Capability = {
  icon: typeof Workflow;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
};

const capabilities: Capability[] = [
  {
    icon: Workflow,
    title: "50+ Automated Workflows",
    subtitle: "Hands-free finance operations",
    color: "#818cf8",
    bg: "rgba(129,140,248,0.1)",
    border: "rgba(129,140,248,0.28)",
    glow: "rgba(129,140,248,0.22)",
  },
  {
    icon: LayoutDashboard,
    title: "100+ Reports & Dashboards",
    subtitle: "Real-time business insight",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.1)",
    border: "rgba(167,139,250,0.28)",
    glow: "rgba(167,139,250,0.22)",
  },
  {
    icon: Boxes,
    title: "15+ Integrated Business Modules",
    subtitle: "One unified platform",
    color: "#c4b5fd",
    bg: "rgba(196,181,253,0.1)",
    border: "rgba(196,181,253,0.28)",
    glow: "rgba(196,181,253,0.2)",
  },
  {
    icon: Bot,
    title: "AI-Powered Accounting Assistant",
    subtitle: "Powered by Gemini AI",
    color: "#34d399",
    bg: "rgba(52,211,153,0.1)",
    border: "rgba(52,211,153,0.28)",
    glow: "rgba(52,211,153,0.22)",
  },
  {
    icon: Landmark,
    title: "Real-Time Bank Reconciliation",
    subtitle: "Match transactions instantly",
    color: "#6ee7b7",
    bg: "rgba(110,231,183,0.1)",
    border: "rgba(110,231,183,0.28)",
    glow: "rgba(110,231,183,0.2)",
  },
  {
    icon: ShieldCheck,
    title: "GST & TDS Compliance Automation",
    subtitle: "Stay compliant, effortlessly",
    color: "#818cf8",
    bg: "rgba(129,140,248,0.1)",
    border: "rgba(129,140,248,0.28)",
    glow: "rgba(129,140,248,0.22)",
  },
  {
    icon: ReceiptText,
    title: "Smart Invoicing & Payments",
    subtitle: "Get paid faster",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.1)",
    border: "rgba(167,139,250,0.28)",
    glow: "rgba(167,139,250,0.22)",
  },
  {
    icon: Users,
    title: "Enterprise RBAC & Team Collaboration",
    subtitle: "Secure, role-based access",
    color: "#34d399",
    bg: "rgba(52,211,153,0.1)",
    border: "rgba(52,211,153,0.28)",
    glow: "rgba(52,211,153,0.22)",
  },
];

function CapabilityCard({ cap, index }: { cap: Capability; index: number }) {
  const Icon = cap.icon;
  return (
    <motion.li
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.4 + index * 0.05 }}
      whileHover={{ y: -4 }}
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        textAlign: "left",
        gap: 14,
        padding: "20px 18px",
        borderRadius: 16,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.012) 100%)",
        border: "1px solid var(--border)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        overflow: "hidden",
        cursor: "default",
        transition: "border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease",
        listStyle: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = cap.border;
        e.currentTarget.style.boxShadow = `0 10px 36px -12px ${cap.glow}`;
        const glow = e.currentTarget.querySelector<HTMLDivElement>("[data-glow]");
        if (glow) glow.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
        const glow = e.currentTarget.querySelector<HTMLDivElement>("[data-glow]");
        if (glow) glow.style.opacity = "0";
      }}
    >
      {/* Hover glow */}
      <div
        data-glow
        aria-hidden
        style={{
          position: "absolute",
          top: -60,
          right: -40,
          width: 160,
          height: 160,
          background: `radial-gradient(circle, ${cap.glow} 0%, transparent 70%)`,
          opacity: 0,
          transition: "opacity 0.3s ease",
          pointerEvents: "none",
        }}
      />

      {/* Icon tile */}
      <div
        aria-hidden
        style={{
          position: "relative",
          width: 42,
          height: 42,
          borderRadius: 12,
          background: cap.bg,
          border: `1px solid ${cap.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={19} color={cap.color} strokeWidth={2} />
      </div>

      {/* Text */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          {cap.title}
        </h3>
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--text-muted)",
            fontWeight: 500,
          }}
        >
          {cap.subtitle}
        </p>
      </div>
    </motion.li>
  );
}

export default function LandingHero() {
  return (
    <section
      style={{
        minHeight: "calc(100vh - 60px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "80px 24px 72px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Scoped responsive grid: 4 cols desktop, 2 tablet, 1 mobile */}
      <style>{`
        .hero-cap-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 0;
        }
        @media (max-width: 900px) {
          .hero-cap-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          .hero-cap-grid { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>

      {/* Background glows */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: "5%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 600,
            background:
              "radial-gradient(ellipse at center, rgba(99,102,241,0.18) 0%, rgba(16,185,129,0.07) 45%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "8%",
            width: 350,
            height: 350,
            background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "20%",
            right: "8%",
            width: 300,
            height: 300,
            background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1180 }}>
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 14px",
            borderRadius: 99,
            background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.25)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--brand-400)",
            marginBottom: 28,
            letterSpacing: "0.02em",
          }}
        >
          <Sparkles size={12} />
          The Financial Operating System for Modern Teams
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          style={{
            fontSize: "clamp(36px, 5.6vw, 64px)",
            fontWeight: 800,
            lineHeight: 1.07,
            letterSpacing: "-0.04em",
            color: "var(--text-primary)",
            marginBottom: 22,
            maxWidth: 920,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Built for{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Modern Finance Teams.
          </span>
          <br />
          One Platform.{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Every Financial Workflow.
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          style={{
            fontSize: "clamp(15px, 1.8vw, 18px)",
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            maxWidth: 720,
            margin: "0 auto 40px",
          }}
        >
          FinRP unifies banking, accounting, invoicing, inventory, compliance, GST, TDS,
          payroll, CRM, analytics, and AI automation into one integrated financial operating
          system for businesses and CA firms.
        </motion.p>

        {/* Dual CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 56,
          }}
        >
          <Link
            href="/sign-up"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 26px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "white",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 4px 24px rgba(99,102,241,0.35)",
            }}
          >
            <Building2 size={16} />
            I&apos;m a CA Firm
            <ArrowRight size={15} />
          </Link>
          <Link
            href="/sign-up"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 26px",
              borderRadius: 12,
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              color: "#34d399",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Briefcase size={16} />
            I&apos;m a Business
            <ArrowRight size={15} />
          </Link>
        </motion.div>

        {/* Capability cards */}
        <ul className="hero-cap-grid">
          {capabilities.map((cap, i) => (
            <CapabilityCard key={cap.title} cap={cap} index={i} />
          ))}
        </ul>
      </div>
    </section>
  );
}
