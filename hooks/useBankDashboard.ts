"use client";

import { useQuery, useQueryClient } from "@/lib/queryCache";
import { useCallback } from "react";

export interface BankDashboardData {
  kpis: {
    totalBalance: number;
    availableBalance: number;
    ledgerBalance: number;
    lastUpdated: string | null;
    monthlyInflow: number;
    monthlyOutflow: number;
    netCashFlow: number;
    pendingReconciliation: number;
    unmatchedTxns: number;
    connectedAccounts: number;
    openRiskAlerts: number;
  };
  accounts: Array<{
    id: string;
    bankName: string;
    currentBalance: number;
    availableBalance: number;
    lastSyncAt: string | null;
    healthScore: number | null;
  }>;
  insights: Array<{
    id: string;
    insightType: string;
    title: string;
    summary: string;
    severity: string | null;
    createdAt: string;
  }>;
  reconProgress: {
    totalTxns: number;
    matchedTxns: number;
    unmatchedTxns: number;
  };
  beneficiaries: {
    active: number;
    pending: number;
    failed: number;
    inactive: number;
    total: number;
  };
  payments: {
    checkerPending: number;
    inFlight: number;
    succeeded: number;
    failed: number;
    settledThisMonth: number;
    settledCountThisMonth: number;
    scheduled: number;
    bulk: number;
    recent: Array<{
      id: string;
      amount: number;
      paymentType: string;
      status: string;
      createdAt: string;
      purchase: { purchaseNumber: string; vendorName: string | null; vendor: { name: string } | null };
    }>;
  };
}

async function fetchDashboard(period: string): Promise<BankDashboardData> {
  const res = await fetch(`/api/banking/dashboard?period=${period}`);
  if (!res.ok) throw new Error("Failed to fetch banking dashboard");
  return res.json();
}

export function useBankDashboard(period: string = "this_month") {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<BankDashboardData>(
    ["banking", "dashboard", period],
    () => fetchDashboard(period),
    { staleTime: 60_000 }
  );

  const refresh = useCallback(() => {
    qc.invalidate(["banking", "dashboard"]);
  }, [qc]);

  return {
    kpis: data?.kpis ?? null,
    accounts: data?.accounts ?? [],
    insights: data?.insights ?? [],
    reconProgress: data?.reconProgress ?? null,
    beneficiaries: data?.beneficiaries ?? null,
    payments: data?.payments ?? null,
    isLoading,
    error,
    refresh,
  };
}
