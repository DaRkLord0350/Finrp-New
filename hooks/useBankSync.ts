"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

interface SyncStatus {
  id: string;
  accountName: string;
  bankName: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  nextSyncAt: string | null;
  autoSyncEnabled: boolean;
}

async function fetchSyncStatus(): Promise<SyncStatus[]> {
  const res = await fetch("/api/banking/sync");
  if (!res.ok) throw new Error("Failed to fetch sync status");
  const data = await res.json();
  return data.accounts ?? [];
}

export function useBankSync() {
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<SyncStatus[]>(
    ["banking", "sync", "status"],
    fetchSyncStatus,
    { staleTime: 20_000 }
  );

  const syncAccount = useCallback(async (bankAccountId: string, force = false) => {
    setSyncingIds(prev => new Set(prev).add(bankAccountId));
    setErrors(prev => { const n = { ...prev }; delete n[bankAccountId]; return n; });

    try {
      const res = await fetch("/api/banking/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId, force }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Sync failed");
      }

      // Optimistically refresh after a delay for the worker to complete
      setTimeout(() => {
        qc.invalidate(["banking", "sync", "status"]);
        qc.invalidate(["banking", "accounts"]);
        qc.invalidate(["banking", "transactions"]);
        qc.invalidate(["banking", "dashboard"]);
      }, 5000);

      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      setErrors(prev => ({ ...prev, [bankAccountId]: message }));
      throw err;
    } finally {
      setSyncingIds(prev => { const n = new Set(prev); n.delete(bankAccountId); return n; });
    }
  }, [qc]);

  const syncAll = useCallback(async () => {
    const accounts = data ?? [];
    for (const account of accounts) {
      if (!syncingIds.has(account.id)) {
        await syncAccount(account.id).catch(() => {});
      }
    }
  }, [data, syncingIds, syncAccount]);

  const connectSetu = useCallback(async (bankAccountId?: string) => {
    const res = await fetch("/api/banking/setu/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccountId }),
    });
    if (!res.ok) throw new Error("Failed to initiate Setu connection");
    const { redirectUrl } = await res.json();
    window.location.href = redirectUrl;
  }, []);

  const createPlaidLinkToken = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/banking/plaid/create-link-token", { method: "POST" });
    if (!res.ok) throw new Error("Failed to create Plaid link token");
    const { linkToken } = await res.json();
    return linkToken;
  }, []);

  const exchangePlaidToken = useCallback(async (
    publicToken: string,
    institutionName?: string,
    institutionId?: string
  ) => {
    const res = await fetch("/api/banking/plaid/exchange-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicToken, institutionName, institutionId }),
    });
    if (!res.ok) throw new Error("Failed to connect bank");
    qc.invalidate(["banking", "accounts"]);
    return res.json();
  }, [qc]);

  return {
    syncStatuses: data ?? [],
    isLoading,
    syncingIds,
    errors,
    syncAccount,
    syncAll,
    connectSetu,
    createPlaidLinkToken,
    exchangePlaidToken,
    isSyncing: (id: string) => syncingIds.has(id),
  };
}
