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

  return {
    invoices,
    loading: isLoading,
    error: null as string | null,
    refetch: () => qc.invalidate(["invoices"]),
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
