"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  transactionDate: string;
  valueDate: string | null;
  narration: string;
  referenceNumber: string | null;
  credit: number | null;
  debit: number | null;
  balance: number | null;
  category: string | null;
  subCategory: string | null;
  txnType: string;
  status: string;
  reconcileStatus: string;
  source: string;
  isFlagged: boolean;
  isDuplicate: boolean;
  tags: string[];
  notes: string | null;
  bankAccount: { bankName: string; accountNumber: string };
}

export interface TransactionFilters {
  bankAccountId?: string;
  status?: string;
  reconcileStatus?: string;
  category?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
}

async function fetchTransactions(filters: TransactionFilters) {
  const params = new URLSearchParams();
  if (filters.bankAccountId) params.set("bankAccountId", filters.bankAccountId);
  if (filters.status) params.set("status", filters.status);
  if (filters.reconcileStatus) params.set("reconcileStatus", filters.reconcileStatus);
  if (filters.category) params.set("category", filters.category);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q) params.set("q", filters.q);
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 50));

  const res = await fetch(`/api/banking/transactions?${params}`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json() as Promise<{
    transactions: BankTransaction[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>;
}

export function useBankTransactions(initialFilters: TransactionFilters = {}) {
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const qc = useQueryClient();

  const queryKey = ["banking", "transactions", JSON.stringify(filters)];

  const { data, isLoading, error } = useQuery(
    queryKey,
    () => fetchTransactions(filters),
    { staleTime: 15_000 }
  );

  const updateFilters = useCallback((next: Partial<TransactionFilters>) => {
    setFilters(prev => ({ ...prev, ...next, page: next.page ?? 1 }));
  }, []);

  const updateTransaction = useCallback(async (
    id: string,
    updates: Record<string, unknown>
  ) => {
    const res = await fetch(`/api/banking/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update transaction");
    qc.invalidate(["banking", "transactions"]);
    return res.json();
  }, [qc]);

  const bulkCategorize = useCallback(async (
    transactionIds: string[],
    category: string,
    subCategory?: string,
    txnType?: string
  ) => {
    const res = await fetch("/api/banking/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionIds, category, subCategory, txnType }),
    });
    if (!res.ok) throw new Error("Failed to bulk categorize");
    qc.invalidate(["banking", "transactions"]);
    return res.json();
  }, [qc]);

  const exportTransactions = useCallback((format: "csv" | "xlsx" = "csv") => {
    const params = new URLSearchParams();
    if (filters.bankAccountId) params.set("bankAccountId", filters.bankAccountId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.category) params.set("category", filters.category);
    params.set("format", format);
    window.open(`/api/banking/transactions/export?${params}`, "_blank");
  }, [filters]);

  return {
    transactions: data?.transactions ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pages: data?.pages ?? 1,
    isLoading,
    error,
    filters,
    updateFilters,
    updateTransaction,
    bulkCategorize,
    exportTransactions,
  };
}
