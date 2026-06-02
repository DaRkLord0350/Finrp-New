"use client";
import { useState, useEffect, useCallback } from "react";

export interface TredsInvoice {
  id: string;
  invoiceNumber: string;
  buyerName: string;
  buyerGstin: string | null;
  invoiceAmount: number;
  dueDate: string;
  status: string;
  financierName: string | null;
  financingRate: number | null;
  fundingAmount: number | null;
  submittedAt: string | null;
  approvedAt: string | null;
  fundedAt: string | null;
  settlementDate: string | null;
  rejectionReason: string | null;
  m1ReferenceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useTredsInvoices(status?: string, search?: string) {
  const [invoices, setInvoices] = useState<TredsInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (status) p.set("status", status);
      if (search) p.set("search", search);
      const res = await fetch(`/api/treds/invoices?${p}`);
      if (!res.ok) throw new Error("Failed to load invoices");
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.invoices ?? [];
      setInvoices(list);
      setTotal(json.total ?? list.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  return { invoices, total, loading, error, refetch: load };
}
