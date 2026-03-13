"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface LoanApplication {
  id: string;
  type: string;
  amount: number;
  bank: string;
  interestRate: number;
  tenure: number;
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "COMPLETED" | "REJECTED";
}

interface LoanApplicationsProps {
  applications: LoanApplication[];
  onViewDetails?: (id: string) => void;
}

const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: "rgba(251, 146, 60, 0.1)", text: "#ea580c", border: "rgba(251, 146, 60, 0.2)" },
  UNDER_REVIEW: { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6", border: "rgba(59, 130, 246, 0.2)" },
  APPROVED: { bg: "rgba(16, 185, 129, 0.1)", text: "#10b981", border: "rgba(16, 185, 129, 0.2)" },
  ACTIVE: { bg: "rgba(99, 102, 241, 0.1)", text: "#6366f1", border: "rgba(99, 102, 241, 0.2)" },
  COMPLETED: { bg: "rgba(107, 114, 128, 0.1)", text: "#6b7280", border: "rgba(107, 114, 128, 0.2)" },
  REJECTED: { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444", border: "rgba(239, 68, 68, 0.2)" },
};

export default function LoanApplications({ applications, onViewDetails }: LoanApplicationsProps) {
  return (
    <motion.div
      className="section-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div style={{ marginBottom: 24 }}>
        <h3 className="section-title">Active Loan Applications</h3>
        <p className="section-subtitle">Track your loan applications and approvals</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 16 }}>
        {applications.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--text-muted)",
              gridColumn: "1 / -1",
            }}
          >
            <p style={{ fontSize: 14 }}>No active loan applications</p>
          </div>
        ) : (
          applications.map((app, idx) => {
            const config = statusConfig[app.status];
            return (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-lg)",
                  padding: 20,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
                className="hover:shadow-lg"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-overlay)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                      {app.type}
                    </h4>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{app.bank}</p>
                  </div>
                  <div
                    style={{
                      background: config.bg,
                      color: config.text,
                      padding: "6px 12px",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                      fontWeight: 600,
                      border: `1px solid ${config.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {app.status.replace(/_/g, " ")}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Loan Amount</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                      ₹{(app.amount / 100000).toFixed(1)}L
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Interest Rate</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: "#6366f1" }}>{app.interestRate}%</p>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Tenure: {app.tenure} months</p>
                  </div>
                  <button
                    onClick={() => onViewDetails?.(app.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#6366f1",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.gap = "10px";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.gap = "6px";
                    }}
                  >
                    View Details
                    <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
