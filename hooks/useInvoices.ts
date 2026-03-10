"use client";

// ============================================================
// useInvoices — CRUD hook for invoices + billing data
// ============================================================

import { useState, useEffect, useCallback } from "react";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  organizationId: string;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { name: string; email?: string | null } | null;
}

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/invoices");
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : (data.invoices ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Derived stats
  const paid = invoices.filter((i) => i.status === "PAID");
  const outstanding = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE");
  const overdue = invoices.filter((i) => i.status === "OVERDUE");

  const totalRevenue = paid.reduce((s, i) => s + Number(i.total), 0);
  const totalOutstanding = outstanding.reduce((s, i) => s + Number(i.total), 0);

  return {
    invoices,
    loading,
    error,
    refetch: fetchInvoices,
    stats: {
      total: invoices.length,
      paid: paid.length,
      outstanding: outstanding.length,
      overdue: overdue.length,
      totalRevenue,
      totalOutstanding,
    },
  };
}
