"use client";

// ============================================================
// useJournals — Manual Journals data hooks
// Built on lib/queryCache (TanStack-Query-style cache).
// ============================================================

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

export type JournalStatus = "DRAFT" | "POSTED" | "VOID";
export type JournalType = "MANUAL" | "SYSTEM" | "OPENING" | "CLOSING" | "FOREX" | "ADJUSTMENT";
export type EntryType = "DEBIT" | "CREDIT";

export interface JournalListItem {
  id: string;
  journalNumber: string | null;
  status: JournalStatus;
  journalType: JournalType;
  entryDate: string;
  reference: string | null;
  description: string | null;
  source: string | null;
  currency: string;
  totalDebit: string | number;
  totalCredit: string | number;
  createdAt: string;
  createdByUser: { name: string | null; email: string } | null;
  _count: { lines: number };
}

export interface JournalLineDetail {
  id: string;
  accountId: string;
  type: EntryType;
  amount: string | number;
  description: string | null;
  lineOrder: number;
  account: { id: string; code: string; name: string; type: string };
}

export interface JournalDetail extends Omit<JournalListItem, "_count"> {
  notes: string | null;
  exchangeRate: string | number;
  postedAt: string | null;
  lines: JournalLineDetail[];
  postedByUser: { name: string | null; email: string } | null;
  reversalOf: { id: string; journalNumber: string | null } | null;
  reversals: { id: string; journalNumber: string | null }[];
}

export interface JournalLineInput {
  accountId: string;
  type: EntryType;
  amount: number;
  description?: string | null;
}

export interface CreateJournalPayload {
  entryDate: string;
  reference?: string | null;
  description?: string | null;
  notes?: string | null;
  currency?: string;
  exchangeRate?: number;
  lines: JournalLineInput[];
  post?: boolean;
}

export interface JournalListFilters {
  q?: string;
  status?: JournalStatus;
  journalType?: JournalType;
  from?: string;
  to?: string;
  sortBy?: "entryDate" | "journalNumber" | "createdAt" | "totalDebit";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

interface JournalListResponse {
  data: JournalListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const LIST_KEY = "journals";

function buildQuery(f: JournalListFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("status", f.status);
  if (f.journalType) p.set("journalType", f.journalType);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  p.set("sortBy", f.sortBy ?? "entryDate");
  p.set("sortDir", f.sortDir ?? "desc");
  p.set("page", String(f.page ?? 1));
  p.set("pageSize", String(f.pageSize ?? 25));
  return p.toString();
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new Error(body?.error ?? fallback);
}

export function useJournals(filters: JournalListFilters) {
  const qc = useQueryClient();
  const queryString = buildQuery(filters);
  const { data, isLoading } = useQuery<JournalListResponse>(
    [LIST_KEY, "list", queryString],
    async () => {
      const res = await fetch(`/api/accounting/journals?${queryString}`);
      if (!res.ok) return parseError(res, "Failed to load journals");
      return res.json();
    },
    { staleTime: 20_000 }
  );

  const refetch = useCallback(() => qc.invalidatePrefix([LIST_KEY]), [qc]);

  return {
    journals: data?.data ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    refetch,
  };
}

export function useJournal(id: string | null) {
  const { data, isLoading } = useQuery<JournalDetail>(
    [LIST_KEY, "detail", id ?? ""],
    async () => {
      const res = await fetch(`/api/accounting/journals/${id}`);
      if (!res.ok) return parseError(res, "Failed to load journal");
      return res.json();
    },
    { enabled: !!id, staleTime: 10_000 }
  );
  return { journal: data, loading: isLoading };
}

export function useJournalMutations() {
  const qc = useQueryClient();
  const invalidate = useCallback(() => qc.invalidatePrefix([LIST_KEY]), [qc]);

  const create = useCallback(async (payload: CreateJournalPayload): Promise<JournalDetail> => {
    const res = await fetch("/api/accounting/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return parseError(res, "Failed to create journal");
    invalidate();
    return res.json();
  }, [invalidate]);

  const update = useCallback(async (id: string, payload: CreateJournalPayload): Promise<JournalDetail> => {
    const res = await fetch(`/api/accounting/journals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return parseError(res, "Failed to update journal");
    invalidate();
    return res.json();
  }, [invalidate]);

  const action = useCallback(async (id: string, verb: "post" | "reverse" | "void"): Promise<JournalDetail> => {
    const res = await fetch(`/api/accounting/journals/${id}/${verb}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) return parseError(res, `Failed to ${verb} journal`);
    invalidate();
    return res.json();
  }, [invalidate]);

  const remove = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/accounting/journals/${id}`, { method: "DELETE" });
    if (!res.ok) return parseError(res, "Failed to delete journal");
    invalidate();
  }, [invalidate]);

  return { create, update, post: (id: string) => action(id, "post"), reverse: (id: string) => action(id, "reverse"), void: (id: string) => action(id, "void"), remove };
}
