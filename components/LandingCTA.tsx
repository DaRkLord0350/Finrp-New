"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Building2, Briefcase, CheckCircle } from "lucide-react";

const caChecks = [
  "Compliance deadline automation",
  "Multi-client portal management",
  "Team task allocation & tracking",
  "Document collection workflows",
];

const businessChecks = [
  "Real-time financial dashboard",
  "GST, ITR & TDS filing status",
  "AI-powered financial insights",
  "Tally, Zoho & TReDS integrations",
];

export default function LandingCTA() {
  return (
    <section style={{ padding: "40px 24px 100px", maxWidth: 1280, margin: "0 auto" }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        style={{
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(16,185,129,0.05) 100%)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 24,
          padding: "56px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: "-50%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 700,
            height: 500,
            background:
              "radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Split CTA grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: "48px 64px",
              alignItems: "start",
            }}
          >
            {/* CA Firms column */}
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  borderRadius: 99,
                  background: "rgba(129,140,248,0.12)",
                  border: "1px solid rgba(129,140,248,0.25)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  color: "#818cf8",
                  marginBottom: 16,
                }}
              >
                <Building2 size={11} />
                For CA Firms
              </div>
              <h3
                style={{
                  fontSize: "clamp(20px, 2.8vw, 28px)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.03em",
                  marginBottom: 12,
                  lineHeight: 1.2,
                }}
              >
                Ready to modernize your practice?
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.65,
                  marginBottom: 20,
                }}
              >
                Join hundreds of CA firms using FinRP to manage clients, automate
                compliance, and grow their practice.
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                }}
              >
                {caChecks.map((c) => (
                  <li
                    key={c}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <CheckCircle size={14} color="#818cf8" style={{ flexShrink: 0 }} />
                    {c}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "13px 24px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 4px 24px rgba(99,102,241,0.35)",
                }}
              >
                Start as a CA Firm
                <ArrowRight size={15} />
              </Link>
            </div>

            {/* Business column */}
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  borderRadius: 99,
                  background: "rgba(52,211,153,0.1)",
                  border: "1px solid rgba(52,211,153,0.25)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase" as const,
                  color: "#34d399",
                  marginBottom: 16,
                }}
              >
                <Briefcase size={11} />
                For Businesses
              </div>
              <h3
                style={{
                  fontSize: "clamp(20px, 2.8vw, 28px)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.03em",
                  marginBottom: 12,
                  lineHeight: 1.2,
                }}
              >
                Take control of your compliance.
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.65,
                  marginBottom: 20,
                }}
              >
                Work with your CA inside the same platform. Track every filing, share
                documents, and stay informed — always.
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                }}
              >
                {businessChecks.map((c) => (
                  <li
                    key={c}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <CheckCircle size={14} color="#34d399" style={{ flexShrink: 0 }} />
                    {c}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "13px 24px",
                  borderRadius: 12,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  color: "#34d399",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Start as a Business
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* Bottom note */}
          <div
            style={{
              marginTop: 48,
              paddingTop: 32,
              borderTop: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Free plan available · No credit card required · Setup in under 5 minutes
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
