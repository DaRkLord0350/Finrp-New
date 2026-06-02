"use client";

import { useQuery, useQueryClient } from "@/lib/queryCache";

export interface AnalyticsData {
  totalRevenue: number;
  revenueGrowth: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalCustomers: number;
  avgDealSize: number;
  monthlyRevenue: { month: string; revenue: number; invoices: number }[];
  paymentMix?: { name: string; value: number; color: string }[];
  topCustomers?: { name: string; revenue: number }[];
}

const DEFAULT: AnalyticsData = {
  totalRevenue: 0, revenueGrowth: 0, totalInvoices: 0, paidInvoices: 0,
  overdueInvoices: 0, totalCustomers: 0, avgDealSize: 0, monthlyRevenue: [],
};

async function fetchAnalytics(): Promise<AnalyticsData> {
  const res = await fetch("/api/analytics");
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export function useAnalytics() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<AnalyticsData>(
    ["analytics"],
    fetchAnalytics,
    { staleTime: 5 * 60_000 }
  );

  return {
    ...(data ?? DEFAULT),
    loading: isLoading,
    error: null as string | null,
    refetch: () => qc.invalidate(["analytics"]),
  };
}
