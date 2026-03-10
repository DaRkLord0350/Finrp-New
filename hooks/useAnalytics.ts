"use client";

// ============================================================
// useAnalytics — Fetch aggregated analytics from /api/analytics
// ============================================================

import { useState, useEffect, useCallback } from "react";

export interface AnalyticsData {
  totalRevenue: number;
  revenueGrowth: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalCustomers: number;
  avgDealSize: number;
  monthlyRevenue: { month: string; revenue: number; invoices: number }[];
}

const DEFAULT_ANALYTICS: AnalyticsData = {
  totalRevenue: 0,
  revenueGrowth: 0,
  totalInvoices: 0,
  paidInvoices: 0,
  overdueInvoices: 0,
  totalCustomers: 0,
  avgDealSize: 0,
  monthlyRevenue: [],
};

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData>(DEFAULT_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  return { ...data, loading, error, refetch: fetchAnalytics };
}
