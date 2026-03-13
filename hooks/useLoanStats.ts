"use client";

import { useState, useEffect, useCallback } from "react";

export interface LoanStatsData {
  annualTurnover: number;
  turnoverGrowth: number;
  monthlyCashFlow: number;
  outstandingLoans: number;
  creditScore: number;
  loanApplications: Array<{
    id: string;
    type: string;
    amount: number;
    bank: string;
    interestRate: number;
    tenure: number;
    status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "COMPLETED" | "REJECTED";
  }>;
  loanProducts: Array<{
    id: string;
    name: string;
    tag: string;
    interestRateMin: number;
    interestRateMax: number;
    maxAmount: number;
    processingFee: number;
    bank: string;
  }>;
  cmaReport: {
    generatedDate: string;
    annualTurnover: number;
    profitMargin: number;
    financialHealth: "Good" | "Fair" | "Poor" | "Excellent";
  } | null;
  cashFlow: {
    inflows: Array<{ label: string; amount: number }>;
    outflows: Array<{ label: string; amount: number }>;
    netCashFlow: number;
  };
}

const DEFAULT_LOAN_STATS: LoanStatsData = {
  annualTurnover: 5000000,
  turnoverGrowth: 15,
  monthlyCashFlow: 423000,
  outstandingLoans: 2500000,
  creditScore: 750,
  loanApplications: [],
  loanProducts: [],
  cmaReport: null,
  cashFlow: {
    inflows: [],
    outflows: [],
    netCashFlow: 0,
  },
};

export function useLoanStats() {
  const [data, setData] = useState<LoanStatsData>(DEFAULT_LOAN_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoanStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch from multiple endpoints
      const [statsRes, applicationsRes, productsRes, cmaRes, cashflowRes] = await Promise.all([
        fetch("/api/loans/stats"),
        fetch("/api/loans/applications"),
        fetch("/api/loans/products"),
        fetch("/api/loans/cma-report"),
        fetch("/api/loans/cashflow"),
      ]);

      if (!statsRes.ok || !applicationsRes.ok || !productsRes.ok || !cmaRes.ok || !cashflowRes.ok) {
        throw new Error("Failed to fetch loan data");
      }

      const [stats, applications, products, cma, cashflow] = await Promise.all([
        statsRes.json(),
        applicationsRes.json(),
        productsRes.json(),
        cmaRes.json(),
        cashflowRes.json(),
      ]);

      setData({
        ...stats,
        loanApplications: applications,
        loanProducts: products,
        cmaReport: cma,
        cashFlow: cashflow,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Use default data on error
      setData(DEFAULT_LOAN_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoanStats();
  }, [fetchLoanStats]);

  return { ...data, loading, error, refetch: fetchLoanStats };
}
