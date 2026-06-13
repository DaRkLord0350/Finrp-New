"use client";

// ============================================================
// FinRP Banking OS — Consent + Sync History hooks
// Data layer for /banking/consent and /banking/sync-history,
// backed by /api/banking/consents and /api/banking/sync-history.
// ============================================================

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

export interface BankConsentRecord {
  id: string;
  consentId: string | null;
  provider: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  frequency: string | null;
  fiTypes: string[];
  vua: string | null;
  approvedAt: string | null;
  revokedAt: string | null;
  rejectedAt: string | null;
  lastDataFetchAt: string | null;
  createdAt: string;
  bankAccount: {
    id: string;
    accountName: string;
    bankName: string;
    maskedNumber: string | null;
  } | null;
}

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

export function useBankConsents() {
  const qc = useQueryClient();
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<{ consents: BankConsentRecord[] }>(
    ["banking", "consents"],
    async () => {
      const res = await fetch("/api/banking/consents");
      if (!res.ok) throw new Error("Failed to fetch consents");
      return res.json();
    },
    { staleTime: 30_000 }
  );

  const revokeConsent = useCallback(async (consentDbId: string) => {
    setRevokingIds(prev => new Set(prev).add(consentDbId));
    try {
      const res = await fetch(`/api/banking/consents/${consentDbId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to revoke consent");
      }
      qc.invalidate(["banking", "consents"]);
      qc.invalidate(["banking", "accounts"]);
    } finally {
      setRevokingIds(prev => { const n = new Set(prev); n.delete(consentDbId); return n; });
    }
  }, [qc]);

  return {
    consents: data?.consents ?? [],
    isLoading,
    error,
    revokeConsent,
    isRevoking: (id: string) => revokingIds.has(id),
  };
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
