"use client";

import { TrendingUp, Zap, Briefcase, Award } from "lucide-react";
import StatCard from "@/components/StatCard";

interface LoanStatsProps {
  annualTurnover: number;
  turnoverGrowth: number | null;
  monthlyCashFlow: number;
  outstandingLoans: number;
  creditScore: number | null;
}

// Map CIBIL bands to an honest label; null score → no rating shown.
function creditRatingLabel(score: number | null): string {
  if (score === null) return "no score on record";
  if (score >= 750) return "excellent rating";
  if (score >= 700) return "good rating";
  if (score >= 650) return "fair rating";
  return "needs improvement";
}

export default function LoanStats({
  annualTurnover,
  turnoverGrowth,
  monthlyCashFlow,
  outstandingLoans,
  creditScore,
}: LoanStatsProps) {
  const stats = [
    {
      title: "Annual Turnover",
      value: `₹${(annualTurnover / 100000).toFixed(1)}L`,
      change: turnoverGrowth ?? undefined,
      changeLabel: turnoverGrowth === null ? "no prior-year data" : "from last year",
      icon: TrendingUp,
      iconColor: "#6366f1",
    },
    {
      title: "Monthly Cash Flow",
      value: `₹${(monthlyCashFlow / 1000).toFixed(0)}K`,
      changeLabel: "net cash flow (last 30 days)",
      icon: Zap,
      iconColor: "#10b981",
    },
    {
      title: "Outstanding Loans",
      value: `₹${(outstandingLoans / 100000).toFixed(1)}L`,
      changeLabel: "across active loans",
      icon: Briefcase,
      iconColor: "#3b82f6",
    },
    {
      title: "Credit Score",
      value: creditScore === null ? "—" : String(creditScore),
      changeLabel: creditRatingLabel(creditScore),
      icon: Award,
      iconColor: "#f59e0b",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
      {stats.map((stat, i) => (
        <StatCard key={stat.title} {...stat} index={i} />
      ))}
    </div>
  );
}
