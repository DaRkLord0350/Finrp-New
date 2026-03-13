"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, ArrowLeft } from "lucide-react";
import { useState } from "react";
import LoanStats from "@/components/finance/LoanStats";
import LoanApplications from "@/components/finance/LoanApplications";
import LoanRecommendations from "@/components/finance/LoanRecommendations";
import CMAReport from "@/components/finance/CMAReport";
import CashFlowAnalysis from "@/components/finance/CashFlowAnalysis";
import { useLoanStats } from "@/hooks/useLoanStats";

export default function LoansPage() {
  const router = useRouter();
  const {
    annualTurnover,
    turnoverGrowth,
    monthlyCashFlow,
    outstandingLoans,
    creditScore,
    loanApplications,
    loanProducts,
    cmaReport,
    cashFlow,
    loading,
    error,
    refetch,
  } = useLoanStats();

  const [showLoanModal, setShowLoanModal] = useState(false);

  const handleApplyForLoan = () => {
    setShowLoanModal(true);
    // TODO: Implement loan application modal
  };

  const handleApplyProduct = (productId: string) => {
    console.log("Applying for loan product:", productId);
    setShowLoanModal(true);
    // TODO: Implement pre-filled loan application form
  };

  const handleViewLoanDetails = (loanId: string) => {
    console.log("Viewing loan details:", loanId);
    // TODO: Implement loan details modal/drawer
  };

  return (
    <div>
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>
            Finance & Loan Management
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Manage finances, apply for loans, and track financial health.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => router.push("/finance")}
            style={{
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-primary)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
              (e.currentTarget as HTMLElement).style.borderColor = "#6366f1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
            }}
          >
            <ArrowLeft size={14} />
            Back to Finance
          </button>
          <button
            className="btn-ghost"
            onClick={refetch}
            style={{
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            Refresh
          </button>
          <button
            onClick={handleApplyForLoan}
            style={{
              padding: "8px 16px",
              background: "#6366f1",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#4f46e5";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#6366f1";
            }}
          >
            <Plus size={14} />
            Apply for Loan
          </button>
        </div>
      </motion.div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-lg)",
            padding: "12px 16px",
            color: "#ef4444",
            fontSize: 13,
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {error} —{" "}
          <button
            onClick={refetch}
            style={{
              color: "#ef4444",
              textDecoration: "underline",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* KPI Stats */}
      <LoanStats
        annualTurnover={annualTurnover}
        turnoverGrowth={turnoverGrowth}
        monthlyCashFlow={monthlyCashFlow}
        outstandingLoans={outstandingLoans}
        creditScore={creditScore}
      />

      {/* Loan Applications */}
      {loanApplications && loanApplications.length > 0 && (
        <LoanApplications applications={loanApplications} onViewDetails={handleViewLoanDetails} />
      )}

      {/* Recommended Loan Products */}
      {loanProducts && loanProducts.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <LoanRecommendations products={loanProducts} onApply={handleApplyProduct} />
        </div>
      )}

      {/* Two Column Layout: CMA Report & Loan Recommendations */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
        <div>
          <CMAReport report={cmaReport} isLoading={loading} onDownload={() => console.log("Download CMA report")} />
        </div>
        <motion.div
          className="section-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 className="section-title">Quick Actions</h3>
            <p className="section-subtitle">Manage your loan portfolio</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              style={{
                padding: "14px 16px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
                (e.currentTarget as HTMLElement).style.borderColor = "#6366f1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
              }}
            >
              📋 View Loan Documents
            </button>

            <button
              style={{
                padding: "14px 16px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
                (e.currentTarget as HTMLElement).style.borderColor = "#6366f1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
              }}
            >
              💬 Schedule Bank Consultation
            </button>

            <button
              style={{
                padding: "14px 16px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
                (e.currentTarget as HTMLElement).style.borderColor = "#6366f1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
              }}
            >
              📊 Compare Loan Offers
            </button>

            <button
              style={{
                padding: "14px 16px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
                (e.currentTarget as HTMLElement).style.borderColor = "#6366f1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
              }}
            >
              🔧 Update Financial Details
            </button>
          </div>
        </motion.div>
      </div>

      {/* Cash Flow Analysis */}
      <CashFlowAnalysis
        inflows={cashFlow.inflows}
        outflows={cashFlow.outflows}
        netCashFlow={cashFlow.netCashFlow}
      />
    </div>
  );
}
