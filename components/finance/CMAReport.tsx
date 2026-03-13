"use client";

import { motion } from "framer-motion";
import { Download, Calendar } from "lucide-react";

interface CMAReportData {
  generatedDate: string;
  annualTurnover: number;
  profitMargin: number;
  financialHealth: "Good" | "Fair" | "Poor" | "Excellent";
}

interface CMAReportProps {
  report: CMAReportData | null;
  isLoading?: boolean;
  onDownload?: () => void;
}

const healthConfig: Record<string, { bg: string; text: string; icon: string }> = {
  Excellent: { bg: "rgba(16, 185, 129, 0.1)", text: "#10b981", icon: "✓" },
  Good: { bg: "rgba(99, 102, 241, 0.1)", text: "#6366f1", icon: "✓" },
  Fair: { bg: "rgba(251, 146, 60, 0.1)", text: "#ea580c", icon: "!" },
  Poor: { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444", icon: "!" },
};

export default function CMAReport({ report, isLoading = false, onDownload }: CMAReportProps) {
  return (
    <motion.div
      className="section-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div style={{ marginBottom: 24 }}>
        <h3 className="section-title">CMA Report Generator</h3>
        <p className="section-subtitle">Credit Monitoring Analysis reports for banks and financial institutions</p>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "60px 20px" }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "inline-block",
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "3px solid var(--border-strong)",
                borderTopColor: "#6366f1",
                animation: "spin 1s linear infinite",
              }}
            />
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 16 }}>Generating report...</p>
          </div>
        </div>
      ) : report ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 28,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Calendar size={16} style={{ color: "var(--text-muted)" }} />
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Generated: {report.generatedDate}</p>
              </div>
            </div>
            <button
              onClick={onDownload}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "#6366f1",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#4f46e5";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#6366f1";
              }}
            >
              <Download size={14} />
              Download PDF
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            <div style={{ paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Annual Turnover
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                ₹{(report.annualTurnover / 100000).toFixed(0)}L
              </p>
            </div>

            <div style={{ paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Profit Margin
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{report.profitMargin}%</p>
            </div>

            <div style={{ paddingBottom: 20, borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Financial Health
              </p>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: healthConfig[report.financialHealth].bg,
                  color: healthConfig[report.financialHealth].text,
                  borderRadius: "var(--radius-md)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span>{healthConfig[report.financialHealth].icon}</span>
                {report.financialHealth}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, padding: "16px 20px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", borderLeft: "3px solid #6366f1" }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Report Summary</p>
            <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>
              This CMA report provides a comprehensive analysis of your organization's financial health, suitable for loan applications and bank submissions.
            </p>
          </div>
        </motion.div>
      ) : (
        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            borderWidth: "1px",
            borderColor: "var(--border)",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>No CMA report generated yet</p>
          <button
            style={{
              padding: "8px 16px",
              background: "#6366f1",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#4f46e5";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#6366f1";
            }}
          >
            Generate Report
          </button>
        </div>
      )}
    </motion.div>
  );
}
