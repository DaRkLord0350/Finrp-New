"use client";

// ============================================================
// FinRP Banking OS — Sync History hook
// Data layer for /banking/sync-history, backed by /api/banking/sync-history.
// ============================================================

import { useQuery } from "@/lib/queryCache";

export interface BankSyncRunRecord {
  id: string;
  bankAccountId: string | null;
  provider: string;
  trigger: string;
  syncType: string;
  status: string;
  txnsFetched: number;
  txnsSaved: number;
  txnsDuplicate: number;
  balancesSaved: number;
  attempt: number;
  error: string | null;
  errorCode: string | null;
  fromDate: string | null;
  toDate: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  bankAccount: { accountName: string; bankName: string; maskedNumber: string | null } | null;
}

export function useBankSyncHistory(filters?: { bankAccountId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.bankAccountId) params.set("bankAccountId", filters.bankAccountId);
  if (filters?.status) params.set("status", filters.status);
  const queryString = params.toString();

  const { data, isLoading, error } = useQuery<{ runs: BankSyncRunRecord[]; nextCursor: string | null }>(
    ["banking", "sync-history", queryString],
    async () => {
      const res = await fetch(`/api/banking/sync-history${queryString ? `?${queryString}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch sync history");
      return res.json();
    },
    { staleTime: 15_000 }
  );

  return {
    runs: data?.runs ?? [],
    nextCursor: data?.nextCursor ?? null,
    isLoading,
    error,
  };
}
