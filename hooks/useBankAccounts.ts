"use client";

import { useQuery, useQueryClient } from "@/lib/queryCache";
import { useCallback } from "react";

export interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  maskedNumber: string | null;
  accountType: string;
  currency: string;
  currentBalance: number;
  availableBalance: number;
  ledgerBalance: number;
  isPrimary: boolean;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  autoSyncEnabled: boolean;
  healthScore: number | null;
  connection?: { provider: string; status: string } | null;
  _count?: { bankTransactions: number };
}

async function fetchAccounts(): Promise<BankAccount[]> {
  const res = await fetch("/api/banking/accounts");
  if (!res.ok) throw new Error("Failed to fetch bank accounts");
  const data = await res.json();
  return data.accounts ?? [];
}

export function useBankAccounts() {
  const { data, isLoading, error } = useQuery<BankAccount[]>(
    ["banking", "accounts"],
    fetchAccounts,
    { staleTime: 30_000 }
  );
  const qc = useQueryClient();

  const refresh = useCallback(() => {
    qc.invalidate(["banking", "accounts"]);
  }, [qc]);

  const triggerSync = useCallback(async (bankAccountId: string, force = false) => {
    const res = await fetch("/api/banking/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccountId, force }),
    });
    if (!res.ok) throw new Error("Sync request failed");
    const result = await res.json();
    setTimeout(() => qc.invalidate(["banking", "accounts"]), 2000);
    return result;
  }, [qc]);

  const deleteAccount = useCallback(async (id: string) => {
    const res = await fetch(`/api/banking/accounts/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete account");
    qc.invalidate(["banking", "accounts"]);
  }, [qc]);

  const totalBalance = (data ?? []).reduce((s, a) => s + a.currentBalance, 0);
  const availableBalance = (data ?? []).reduce((s, a) => s + a.availableBalance, 0);

  return {
    accounts: data ?? [],
    isLoading,
    error,
    totalBalance,
    availableBalance,
    refresh,
    triggerSync,
    deleteAccount,
  };
}
