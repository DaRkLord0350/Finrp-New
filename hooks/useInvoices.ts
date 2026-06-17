"use client";

import { useQuery, useQueryClient } from "@/lib/queryCache";

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

async function fetchInvoices(): Promise<Invoice[]> {
  const res = await fetch("/api/invoices");
  if (!res.ok) throw new Error("Failed to fetch invoices");
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.invoices ?? [];
}

export function useInvoices() {
  const qc = useQueryClient();
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>(
    ["invoices"],
    fetchInvoices,
    { staleTime: 60_000 }
  );

  const paid        = invoices.filter((i) => i.status === "PAID");
  const outstanding = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE");
  const overdue     = invoices.filter((i) => i.status === "OVERDUE");

  /**
   * Optimistically update a single invoice's status, then persist it.
   * On failure the cache is rolled back to its previous state so the UI
   * never shows a status the server rejected.
   */
  const updateStatus = async (id: string, status: string) => {
    const previous = qc.getData<Invoice[]>(["invoices"]);

    qc.setData<Invoice[]>(["invoices"], (old = []) =>
      old.map((inv) => (inv.id === id ? { ...inv, status } : inv))
    );

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to update status");
      }
    } catch (e) {
      // Roll back the optimistic change.
      if (previous) qc.setData<Invoice[]>(["invoices"], previous);
      throw e;
    }
  };

  return {
    invoices,
    loading: isLoading,
    error: null as string | null,
    refetch: () => qc.invalidate(["invoices"]),
    updateStatus,
    stats: {
      total:            invoices.length,
      paid:             paid.length,
      outstanding:      outstanding.length,
      overdue:          overdue.length,
      totalRevenue:     paid.reduce((s, i) => s + Number(i.total), 0),
      totalOutstanding: outstanding.reduce((s, i) => s + Number(i.total), 0),
    },
  };
}
