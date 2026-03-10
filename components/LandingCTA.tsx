"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";

export default function LandingCTA() {
  return (
    <section style={{ padding: "60px 24px 100px", maxWidth: 1200, margin: "0 auto" }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(16,185,129,0.06) 100%)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 24,
          padding: "60px 40px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background accent */}
        <div
          style={{
            position: "absolute",
            top: "-50%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 600,
            height: 400,
            background: "radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Icon */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, #6366f1, #10b981)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 8px 32px rgba(99,102,241,0.35)",
            }}
          >
            <Zap size={24} color="white" />
          </div>

          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 42px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              marginBottom: 14,
              lineHeight: 1.15,
            }}
          >
            Ready to transform your{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #818cf8, #34d399)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              financial operations?
            </span>
          </h2>

          <p
            style={{
              fontSize: "clamp(14px, 1.5vw, 17px)",
              color: "var(--text-secondary)",
              maxWidth: 480,
              margin: "0 auto 36px",
              lineHeight: 1.6,
            }}
          >
            Join thousands of businesses using FinRP to manage customers, billing,
            compliance, inventory, and AI-powered insights — all in one place.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/sign-up"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "white",
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 4px 24px rgba(99,102,241,0.4)",
              }}
            >
              Create Free Account
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/sign-in"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 28px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign In
            </Link>
          </div>

          <p
            style={{
              marginTop: 22,
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            Free plan available · No credit card required
          </p>
        </div>
      </motion.div>
    </section>
  );
}
