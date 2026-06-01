"use client";
import { useState, useEffect, useCallback } from "react";

export interface TredsDashboardStats {
  totalEligible: number;
  submitted: number;
  discounted: number;
  pendingApproval: number;
  fundsReceived: number;
  avgFinancingRate: number;
}

export interface MonthlyFunding {
  month: string;
  submitted: number;
  approved: number;
  funded: number;
}

export interface FundingByFinancier {
  name: string;
  amount: number;
}

export interface TredsRecentInvoice {
  id: string;
  invoiceNumber: string;
  buyerName: string;
  invoiceAmount: number;
  dueDate: string;
  status: string;
  financierName: string | null;
  financingRate: number | null;
  fundingAmount: number | null;
}

export interface TredsAiInsight {
  title: string;
  description: string;
  type: "opportunity" | "warning" | "info";
}

interface TredsDashboardData {
  stats: TredsDashboardStats;
  monthlyFunding: MonthlyFunding[];
  fundingByFinancier: FundingByFinancier[];
  recentInvoices: TredsRecentInvoice[];
  aiInsights: TredsAiInsight[];
  integration: { status: string; lastSyncAt: string | null; provider: string } | null;
}

const DEFAULT: TredsDashboardData = {
  stats: { totalEligible: 0, submitted: 0, discounted: 0, pendingApproval: 0, fundsReceived: 0, avgFinancingRate: 0 },
  monthlyFunding: [],
  fundingByFinancier: [],
  recentInvoices: [],
  aiInsights: [],
  integration: null,
};

export function useTredsDashboard() {
  const [data, setData] = useState<TredsDashboardData>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/treds/dashboard");
      if (!res.ok) throw new Error("Failed to load TReDS data");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...data, loading, error, refetch: load };
}
