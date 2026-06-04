"use client";

import { useQuery, useQueryClient } from "@/lib/queryCache";
import type { ComplianceDashboardData } from "@/types/compliance";

async function fetchComplianceDashboard(): Promise<ComplianceDashboardData> {
  const res = await fetch("/api/compliance/dashboard");
  if (!res.ok) throw new Error("Failed to fetch compliance dashboard");
  return res.json();
}

export function useComplianceDashboard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<ComplianceDashboardData>(
    ["compliance", "dashboard"],
    fetchComplianceDashboard,
    { staleTime: 2 * 60_000 }
  );

  return {
    data: data ?? null,
    loading: isLoading,
    error: null as string | null,
    refetch: () => qc.invalidate(["compliance", "dashboard"]),
  };
}
