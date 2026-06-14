"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

export interface ReconcileSession {
  id: string;
  bankAccountId: string;
  name: string | null;
  startDate: string;
  endDate: string;
  status: string;
  totalTxns: number;
  matchedTxns: number;
  unmatchedTxns: number;
  exceptionTxns: number;
  openingBalance: number | null;
  closingBalance: number | null;
  createdAt: string;
  bankAccount: { bankName: string; accountNumber: string; accountName: string };
  _count: { matches: number };
}

export interface ReconcileMatch {
  id: string;
  sessionId: string;
  bankTransactionId: string;
  entityType: string | null;
  entityId: string | null;
  entityRef: string | null;
  matchType: string;
  confidence: number | null;
  status: string;
  notes: string | null;
  bankTransaction: {
    transactionDate: string;
    narration: string;
    credit: number | null;
    debit: number | null;
    referenceNumber: string | null;
  };
}

async function fetchSessions(bankAccountId?: string) {
  const params = bankAccountId ? `?bankAccountId=${bankAccountId}` : "";
  const res = await fetch(`/api/banking/reconcile/sessions${params}`);
  if (!res.ok) throw new Error("Failed to fetch sessions");
  const data = await res.json();
  return data.sessions as ReconcileSession[];
}

async function fetchMatches(sessionId: string) {
  const res = await fetch(`/api/banking/reconcile/${sessionId}/matches`);
  if (!res.ok) throw new Error("Failed to fetch matches");
  return res.json() as Promise<{ matches: ReconcileMatch[]; session: ReconcileSession }>;
}

export function useReconcileSessions(bankAccountId?: string) {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery(
    ["banking", "reconcile", "sessions", bankAccountId ?? "all"],
    () => fetchSessions(bankAccountId),
    { staleTime: 30_000 }
  );

  const createSession = useCallback(async (opts: {
    bankAccountId: string;
    name?: string;
    startDate: string;
    endDate: string;
    openingBalance?: number;
    closingBalance?: number;
  }) => {
    const res = await fetch("/api/banking/reconcile/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error("Failed to create session");
    const result = await res.json();
    qc.invalidate(["banking", "reconcile", "sessions"]);
    return result.sessionId as string;
  }, [qc]);

  return { sessions: data ?? [], isLoading, error, createSession };
}

export function useReconcileSession(sessionId: string) {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery(
    ["banking", "reconcile", "session", sessionId],
    () => fetchMatches(sessionId),
    { staleTime: 10_000 }
  );

  const autoMatch = useCallback(async () => {
    const res = await fetch(`/api/banking/reconcile/${sessionId}/auto-match`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Auto-match failed");
    const result = await res.json();
    qc.invalidate(["banking", "reconcile", "session", sessionId]);
    return result as { matched: number; suggested: number };
  }, [sessionId, qc]);

  const manualMatch = useCallback(async (
    bankTransactionId: string,
    entityType: string,
    entityId: string,
    entityRef?: string,
    notes?: string
  ) => {
    const res = await fetch(`/api/banking/reconcile/${sessionId}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankTransactionId, entityType, entityId, entityRef, notes }),
    });
    if (!res.ok) throw new Error("Manual match failed");
    qc.invalidate(["banking", "reconcile", "session", sessionId]);
    return res.json();
  }, [sessionId, qc]);

  const unmatch = useCallback(async (bankTransactionId: string) => {
    const res = await fetch(`/api/banking/reconcile/${sessionId}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unmatch", bankTransactionId }),
    });
    if (!res.ok) throw new Error("Unmatch failed");
    qc.invalidate(["banking", "reconcile", "session", sessionId]);
  }, [sessionId, qc]);

  const completeSession = useCallback(async () => {
    const res = await fetch(`/api/banking/reconcile/${sessionId}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    if (!res.ok) throw new Error("Failed to complete session");
    qc.invalidate(["banking", "reconcile", "sessions"]);
    qc.invalidate(["banking", "reconcile", "session", sessionId]);
  }, [sessionId, qc]);

  const matchRate = data?.session
    ? data.session.totalTxns > 0
      ? Math.round((data.session.matchedTxns / data.session.totalTxns) * 100)
      : 0
    : 0;

  return {
    session: data?.session ?? null,
    matches: data?.matches ?? [],
    isLoading,
    error,
    matchRate,
    autoMatch,
    manualMatch,
    unmatch,
    completeSession,
  };
}
