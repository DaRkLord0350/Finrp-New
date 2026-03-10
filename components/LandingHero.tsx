"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Zap, Play } from "lucide-react";

export default function LandingHero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "80px 24px 60px",
        position: "relative",
      }}
    >
      {/* Background glows */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 500,
          background:
            "radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, rgba(16,185,129,0.06) 40%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "15%",
          width: 300,
          height: 300,
          background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "20%",
          right: "15%",
          width: 250,
          height: 250,
          background: "radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760 }}>
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
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
          AI-Powered Financial Operations Platform
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          style={{
            fontSize: "clamp(38px, 6vw, 66px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            color: "var(--text-primary)",
            marginBottom: 20,
          }}
        >
          Financial Operations{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #818cf8 0%, #34d399 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            for Modern
          </span>{" "}
          Businesses
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          style={{
            fontSize: "clamp(15px, 2vw, 18px)",
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            maxWidth: 580,
            margin: "0 auto 36px",
          }}
        >
          FinRP unifies your customer management, billing, compliance, inventory,
          and analytics into one intelligent platform. Run your entire operation
          from a single dashboard.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}
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
              transition: "all 0.2s ease",
            }}
          >
            Get Started Free
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/sign-in"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 26px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--border-strong)",
              color: "var(--text-primary)",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            <Play size={14} />
            Sign In
          </Link>
        </motion.div>

        {/* Social proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{
            marginTop: 28,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          No credit card required · Free plan available · Setup in under 2 minutes
        </motion.p>
      </div>
    </section>
  );
}
