"use client";

import { motion } from "framer-motion";
import { TrendingUp, Zap, Briefcase, Award } from "lucide-react";
import StatCard from "@/components/StatCard";

interface LoanStatsProps {
  annualTurnover: number;
  turnoverGrowth: number;
  monthlyCashFlow: number;
  outstandingLoans: number;
  creditScore: number;
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
      change: turnoverGrowth,
      changeLabel: "from last year",
      icon: TrendingUp,
      iconColor: "#6366f1",
    },
    {
      title: "Monthly Cash Flow",
      value: `₹${(monthlyCashFlow / 1000).toFixed(0)}K`,
      change: 0,
      changeLabel: "average monthly inflow",
      icon: Zap,
      iconColor: "#10b981",
    },
    {
      title: "Outstanding Loans",
      value: `₹${(outstandingLoans / 100000).toFixed(1)}L`,
      change: 0,
      changeLabel: "across active loans",
      icon: Briefcase,
      iconColor: "#3b82f6",
    },
    {
      title: "Credit Score",
      value: String(creditScore),
      change: 0,
      changeLabel: "excellent rating",
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
