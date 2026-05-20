"use client";

// ============================================================
// useERP — Fetch ERP dashboard data with loading/error/refetch
// Follows useDashboard pattern
// ============================================================

import { useState, useEffect, useCallback } from "react";
import type { ERPDashboardData, ERPMetrics, ERPOperations } from "@/types/erp";

const DEFAULT_METRICS: ERPMetrics = {
  revenueMTD: 0,
  revenueLastMonth: 0,
  revenueGrowth: 0,
  profit: 0,
  profitMargin: 0,
  cashFlow: 0,
  workingCapitalRatio: 0,
  totalSales: 0,
  totalPurchases: 0,
  totalExpenses: 0,
  totalPayroll: 0,
  inventoryValue: 0,
};

const DEFAULT_OPERATIONS: ERPOperations = {
  billableHours: 0,
  slaAdherence: 100,
  projectOverrun: 0,
  resourceAllocation: 0,
};

export function useERP() {
  const [data, setData] = useState<ERPDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchERP = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/erp");
      if (!res.ok) throw new Error("Failed to load ERP data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const seedData = useCallback(async () => {
    try {
      setSeeding(true);
      const res = await fetch("/api/erp/seed", { method: "POST" });
      if (!res.ok) throw new Error("Failed to seed data");
      const result = await res.json();
      if (result.seeded) {
        await fetchERP();
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
      return null;
    } finally {
      setSeeding(false);
    }
  }, [fetchERP]);

  useEffect(() => {
    fetchERP();
  }, [fetchERP]);

  return {
    metrics: data?.metrics ?? DEFAULT_METRICS,
    operations: data?.operations ?? DEFAULT_OPERATIONS,
    alerts: data?.alerts ?? [],
    suggestions: data?.suggestions ?? [],
    projects: data?.projects ?? [],
    hasData: data?.hasData ?? false,
    loading,
    error,
    seeding,
    refetch: fetchERP,
    seedData,
  };
}