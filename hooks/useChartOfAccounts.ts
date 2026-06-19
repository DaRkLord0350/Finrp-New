"use client";

// ============================================================
// useChartOfAccounts — Chart of Accounts data hooks
// Built on lib/queryCache (this project's TanStack-Query-style cache)
// ============================================================

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE" | "COGS" | "STOCK" | "BANK" | "CASH" | "TAX";

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  accountSubType: string | null;
  parentAccountId: string | null;
  parentAccount: { id: string; code: string; name: string } | null;
  balance: string | number;
  openingBalance: string | number;
  isActive: boolean;
  isSystemGenerated: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string | null;
  _count: { children: number; journalLines: number };
}

export interface AccountListFilters {
  q?: string;
  type?: AccountType | "";
  subType?: string;
  status?: "active" | "inactive" | "all";
  sortBy?: "name" | "code" | "balance" | "createdAt";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

interface AccountListResponse {
  data: ChartAccount[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  accountSubType: string | null;
  balance: number;
  isActive: boolean;
  isSystemGenerated: boolean;
  children: AccountTreeNode[];
}

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  accountSubType: string | null;
  parentAccountId: string | null;
}

export type CreateAccountInput = {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountSubType?: string | null;
  parentAccountId?: string | null;
  description?: string | null;
  openingBalance?: number;
};

export type UpdateAccountInput = Partial<{
  accountName: string;
  description: string | null;
  parentAccountId: string | null;
  isActive: boolean;
  accountType: AccountType;
  accountSubType: string | null;
}>;

function buildQuery(filters: AccountListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.subType) params.set("subType", filters.subType);
  params.set("status", filters.status ?? "active");
  params.set("sortBy", filters.sortBy ?? "code");
  params.set("sortDir", filters.sortDir ?? "asc");
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 25));
  return params.toString();
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new Error(body?.error ?? fallback);
}

const LIST_KEY = "chart-of-accounts";

// ---------------------------------------------------------------------------
// List + CRUD
// ---------------------------------------------------------------------------

export function useChartOfAccounts(filters: AccountListFilters) {
  const qc = useQueryClient();
  const queryString = buildQuery(filters);
  const key = [LIST_KEY, "list", queryString];

  const { data, isLoading } = useQuery<AccountListResponse>(
    key,
    async () => {
      const res = await fetch(`/api/chart-of-accounts?${queryString}`);
      if (!res.ok) return parseError(res, "Failed to load chart of accounts");
      return res.json();
    },
    { staleTime: 30_000 }
  );

  const invalidateAll = useCallback(() => {
    qc.invalidatePrefix([LIST_KEY]);
  }, [qc]);

  const createAccount = useCallback(async (input: CreateAccountInput): Promise<ChartAccount> => {
    const res = await fetch("/api/chart-of-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return parseError(res, "Failed to create account");
    const account = await res.json() as ChartAccount;
    invalidateAll();
    return account;
  }, [invalidateAll]);

  const updateAccount = useCallback(async (id: string, input: UpdateAccountInput): Promise<ChartAccount> => {
    const res = await fetch(`/api/chart-of-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return parseError(res, "Failed to update account");
    const account = await res.json() as ChartAccount;
    invalidateAll();
    return account;
  }, [invalidateAll]);

  const deleteAccount = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/chart-of-accounts/${id}`, { method: "DELETE" });
    if (!res.ok) return parseError(res, "Failed to delete account");
    invalidateAll();
  }, [invalidateAll]);

  const bulkUpdate = useCallback(async (accountIds: string[], action: "activate" | "deactivate") => {
    const res = await fetch("/api/chart-of-accounts/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountIds, action }),
    });
    if (!res.ok) return parseError(res, "Bulk update failed");
    const result = await res.json() as { updated: number; skipped: number; message: string };
    invalidateAll();
    return result;
  }, [invalidateAll]);

  return {
    accounts: data?.data ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? filters.page ?? 1,
    pageSize: data?.pageSize ?? filters.pageSize ?? 25,
    loading: isLoading,
    refetch: invalidateAll,
    createAccount,
    updateAccount,
    deleteAccount,
    bulkUpdate,
  };
}

// ---------------------------------------------------------------------------
// Tree view
// ---------------------------------------------------------------------------

export function useAccountTree() {
  const { data, isLoading } = useQuery<{ tree: AccountTreeNode[] }>(
    [LIST_KEY, "tree"],
    async () => {
      const res = await fetch("/api/chart-of-accounts?view=tree");
      if (!res.ok) return parseError(res, "Failed to load account hierarchy");
      return res.json();
    },
    { staleTime: 60_000 }
  );

  return { tree: data?.tree ?? [], loading: isLoading };
}

// ---------------------------------------------------------------------------
// Lightweight options (parent-account dropdown)
// ---------------------------------------------------------------------------

export function useAccountOptions(activeOnly = true) {
  const { data, isLoading } = useQuery<{ accounts: AccountOption[] }>(
    [LIST_KEY, "options", activeOnly],
    async () => {
      const res = await fetch(`/api/chart-of-accounts?view=options&activeOnly=${activeOnly}`);
      if (!res.ok) return parseError(res, "Failed to load accounts");
      return res.json();
    },
    { staleTime: 60_000 }
  );

  return { options: data?.accounts ?? [], loading: isLoading };
}
