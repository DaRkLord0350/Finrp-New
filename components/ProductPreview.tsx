"use client";

import { motion } from "framer-motion";
import {
  UserPlus,
  FolderOpen,
  ShieldCheck,
  ClipboardList,
  CheckCircle,
  BarChart3,
  Building2,
  Package,
  Rocket,
  User,
} from "lucide-react";

/* ─── Who Uses FinRP ─── */

const personas = [
  {
    icon: Building2,
    title: "CA Firms & Practices",
    subtitle: "Practice management for growing offices",
    description:
      "Manage every client, deadline, and team member from one platform. Built for practices of all sizes — from solo CAs to large firms.",
    tags: ["Compliance Tracking", "Client Portal", "Team Management"],
    color: "#818cf8",
    bg: "rgba(129,140,248,0.08)",
    border: "rgba(129,140,248,0.2)",
  },
  {
    icon: Package,
    title: "MSMEs & SMBs",
    subtitle: "Compliance made simple for small businesses",
    description:
      "Stay compliant, track your finances, and collaborate seamlessly with your CA — without the administrative overhead.",
    tags: ["GST Filing", "TDS Tracking", "Financial Reports"],
    color: "#34d399",
    bg: "rgba(52,211,153,0.08)",
    border: "rgba(52,211,153,0.2)",
  },
  {
    icon: Rocket,
    title: "Startups",
    subtitle: "Financial infrastructure from day one",
    description:
      "Get the compliance and reporting foundation your startup needs from the start. Investor-ready dashboards and automated filings.",
    tags: ["Investor Reports", "Startup Compliance", "AI Forecasting"],
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
  },
  {
    icon: User,
    title: "Individual Clients",
    subtitle: "Personal tax and filing visibility",
    description:
      "Always know where your ITR, GST, and filings stand. Securely share documents and communicate with your CA effortlessly.",
    tags: ["ITR Status", "Document Sharing", "CA Communication"],
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.2)",
  },
];

/* ─── Workflow steps ─── */

const workflowSteps = [
  {
    num: "01",
    icon: UserPlus,
    title: "Client Onboarding",
    description: "Add clients, collect KYC, and set up their dedicated portal",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.25)",
  },
  {
    num: "02",
    icon: FolderOpen,
    title: "Document Collection",
    description: "Send requests, track submissions, receive files securely",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.25)",
  },
  {
    num: "03",
    icon: ShieldCheck,
    title: "Compliance Automation",
    description: "Auto-track deadlines, generate checklists, queue returns",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.25)",
  },
  {
    num: "04",
    icon: ClipboardList,
    title: "Assignment",
    description: "Route tasks to team members by expertise and capacity",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.12)",
    border: "rgba(6,182,212,0.25)",
  },
  {
    num: "05",
    icon: CheckCircle,
    title: "Filing",
    description: "Submit returns, capture acknowledgments, notify clients",
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.25)",
  },
  {
    num: "06",
    icon: BarChart3,
    title: "Reporting",
    description: "Generate audit trails, performance reports, and insights",
    color: "#34d399",
    bg: "rgba(52,211,153,0.12)",
    border: "rgba(52,211,153,0.25)",
  },
];

export default function ProductPreview() {
  return (
    <>
      {/* ─── Who Uses FinRP ─── */}
      <section style={{ padding: "72px 24px 0", maxWidth: 1280, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: 48 }}
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
            Who Uses FinRP
          </p>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 40px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              lineHeight: 1.15,
              marginBottom: 14,
            }}
          >
            Designed for the entire{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #818cf8, #34d399)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              CA ecosystem
            </span>
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              maxWidth: 460,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            From solo practitioners to large firms, MSMEs to startups — FinRP scales
            with your needs.
          </p>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {personas.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                whileHover={{ y: -3 }}
                style={{
                  background: p.bg,
                  border: `1px solid ${p.border}`,
                  borderRadius: 18,
                  padding: "24px 24px 20px",
                  transition: "box-shadow 0.2s ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 8px 32px ${p.bg}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.07)",
                    border: `1px solid ${p.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Icon size={20} color={p.color} />
                </div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase" as const,
                    color: p.color,
                    marginBottom: 6,
                  }}
                >
                  {p.subtitle}
                </p>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.02em",
                    marginBottom: 10,
                    lineHeight: 1.2,
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    marginBottom: 16,
                  }}
                >
                  {p.description}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: 99,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─── Workflow Visualization ─── */}
      <section
        id="workflow"
        style={{ padding: "80px 24px", maxWidth: 1280, margin: "0 auto" }}
      >
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
            How It Works
          </p>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 40px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              lineHeight: 1.15,
              marginBottom: 14,
            }}
          >
            End-to-end compliance,{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #818cf8, #34d399)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              automated
            </span>
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              maxWidth: 460,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            From the moment a client joins to the final acknowledgment — every step is
            tracked, assigned, and audited.
          </p>
        </motion.div>

        {/* Workflow steps */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 16,
          }}
        >
          {workflowSteps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                whileHover={{ y: -2 }}
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${step.border}`,
                  borderRadius: 16,
                  padding: "20px 20px 18px",
                  cursor: "default",
                  transition: "box-shadow 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 6px 24px ${step.bg}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 11,
                      background: step.bg,
                      border: `1px solid ${step.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={18} color={step.color} />
                  </div>
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 900,
                      color: "var(--border-strong)",
                      letterSpacing: "-0.04em",
                      lineHeight: 1,
                      opacity: 0.4,
                    }}
                  >
                    {step.num}
                  </span>
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
                  {step.title}
                </h4>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Gradient progress track */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          style={{
            marginTop: 32,
            height: 3,
            borderRadius: 99,
            background:
              "linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6, #06b6d4, #10b981, #34d399)",
            maxWidth: 480,
            margin: "32px auto 0",
            transformOrigin: "left",
          }}
        />
      </section>
    </>
  );
}
