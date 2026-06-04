"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import type { ERPDashboardData, ERPMetrics, ERPOperations } from "@/types/erp";

const DEFAULT_METRICS: ERPMetrics = {
  revenueMTD: 0, revenueLastMonth: 0, revenueGrowth: 0, profit: 0,
  profitMargin: 0, cashFlow: 0, workingCapitalRatio: 0, totalSales: 0,
  totalPurchases: 0, totalExpenses: 0, totalPayroll: 0, inventoryValue: 0,
};

const DEFAULT_OPERATIONS: ERPOperations = {
  billableHours: 0, slaAdherence: 100, projectOverrun: 0, resourceAllocation: 0,
};

async function fetchERP(): Promise<ERPDashboardData> {
  const res = await fetch("/api/erp");
  if (!res.ok) throw new Error("Failed to load ERP data");
  return res.json();
}

export function useERP() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<ERPDashboardData>(
    ["erp"],
    fetchERP,
    { staleTime: 2 * 60_000 }
  );
  const [seeding, setSeeding] = useState(false);

  const seedData = useCallback(async () => {
    try {
      setSeeding(true);
      const res = await fetch("/api/erp/seed", { method: "POST" });
      if (!res.ok) throw new Error("Failed to seed data");
      const result = await res.json();
      if (result.seeded) qc.invalidate(["erp"]);
      return result;
    } finally {
      setSeeding(false);
    }
  }, [qc]);

  return {
    metrics:    data?.metrics    ?? DEFAULT_METRICS,
    operations: data?.operations ?? DEFAULT_OPERATIONS,
    alerts:     data?.alerts     ?? [],
    suggestions: data?.suggestions ?? [],
    projects:   data?.projects   ?? [],
    hasData:    data?.hasData    ?? false,
    loading:    isLoading,
    error:      null as string | null,
    seeding,
    refetch:    () => qc.invalidate(["erp"]),
    seedData,
  };
}
