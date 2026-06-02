"use client";

import { useQuery, useQueryClient } from "@/lib/queryCache";

export interface LoanStatsData {
  annualTurnover: number;
  turnoverGrowth: number;
  monthlyCashFlow: number;
  outstandingLoans: number;
  creditScore: number;
  loanApplications: Array<{
    id: string; type: string; amount: number; bank: string;
    interestRate: number; tenure: number;
    status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "COMPLETED" | "REJECTED";
  }>;
  loanProducts: Array<{
    id: string; name: string; tag: string; interestRateMin: number;
    interestRateMax: number; maxAmount: number; processingFee: number; bank: string;
  }>;
  cmaReport: {
    generatedDate: string; annualTurnover: number;
    profitMargin: number; financialHealth: "Good" | "Fair" | "Poor" | "Excellent";
  } | null;
  cashFlow: {
    inflows: Array<{ label: string; amount: number }>;
    outflows: Array<{ label: string; amount: number }>;
    netCashFlow: number;
  };
}

const DEFAULT: LoanStatsData = {
  annualTurnover: 5_000_000, turnoverGrowth: 15, monthlyCashFlow: 423_000,
  outstandingLoans: 2_500_000, creditScore: 750,
  loanApplications: [], loanProducts: [], cmaReport: null,
  cashFlow: { inflows: [], outflows: [], netCashFlow: 0 },
};

async function fetchLoanStats(): Promise<LoanStatsData> {
  const [statsRes, applicationsRes, productsRes, cmaRes, cashflowRes] = await Promise.all([
    fetch("/api/loans/stats"),
    fetch("/api/loans/applications"),
    fetch("/api/loans/products"),
    fetch("/api/loans/cma-report"),
    fetch("/api/loans/cashflow"),
  ]);
  if (!statsRes.ok) throw new Error("Failed to fetch loan stats");
  const [stats, applications, products, cma, cashflow] = await Promise.all([
    statsRes.json(),
    applicationsRes.ok ? applicationsRes.json() : [],
    productsRes.ok    ? productsRes.json()    : [],
    cmaRes.ok         ? cmaRes.json()         : null,
    cashflowRes.ok    ? cashflowRes.json()    : { inflows: [], outflows: [], netCashFlow: 0 },
  ]);
  return { ...stats, loanApplications: applications, loanProducts: products, cmaReport: cma, cashFlow: cashflow };
}

export function useLoanStats() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<LoanStatsData>(
    ["loanStats"],
    fetchLoanStats,
    { staleTime: 5 * 60_000 }
  );

  return {
    ...(data ?? DEFAULT),
    loading: isLoading,
    error: null as string | null,
    refetch: () => qc.invalidate(["loanStats"]),
  };
}
