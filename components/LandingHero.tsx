"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Building2, Briefcase, Zap } from "lucide-react";

const stats = [
  { value: "500+", label: "CA Practices" },
  { value: "10K+", label: "Clients Managed" },
  { value: "₹2,000Cr+", label: "Filings Processed" },
  { value: "99.9%", label: "Uptime" },
];

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

      <div style={{ position: "relative", zIndex: 1, maxWidth: 840, width: "100%" }}>
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
          <Zap size={12} />
          CA Practice Management · Financial Operations Platform
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          style={{
            fontSize: "clamp(38px, 6vw, 68px)",
            fontWeight: 800,
            lineHeight: 1.06,
            letterSpacing: "-0.04em",
            color: "var(--text-primary)",
            marginBottom: 22,
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
            CA Firms.
          </span>
          <br />
          Trusted by{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Businesses.
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
            maxWidth: 620,
            margin: "0 auto 40px",
          }}
        >
          FinRP gives CA firms a complete practice management suite — client onboarding,
          compliance automation, document collection, and team workflows. Businesses get
          real-time visibility into filings, finances, and obligations.
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
            marginBottom: 52,
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

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.38 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 12,
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                textAlign: "center",
                padding: "14px 10px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <p
                style={{
                  fontSize: "clamp(20px, 2.5vw, 28px)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                }}
              >
                {s.value}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 4,
                  fontWeight: 500,
                }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
