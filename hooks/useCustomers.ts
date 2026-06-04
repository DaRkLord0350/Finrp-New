"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  notes?: string | null;
  customerType?: string;
  creditLimit?: number;
  outstandingAmount?: number;
  totalPurchases?: number;
  customerScore?: number;
  isActive?: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { invoices: number };
  totalRevenue?: number;
  outstandingRevenue?: number;
}

interface PaginatedCustomers {
  data: Customer[];
  nextCursor: string | null;
  hasMore: boolean;
}

async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch("/api/customers?take=50");
  if (!res.ok) throw new Error("Failed to fetch customers");
  const json = await res.json() as PaginatedCustomers | Customer[];
  // Handle both paginated and legacy array responses
  if (Array.isArray(json)) return json;
  return (json as PaginatedCustomers).data ?? [];
}

export function useCustomers() {
  const qc = useQueryClient();
  const { data: customers = [], isLoading } = useQuery<Customer[]>(
    ["customers"],
    fetchCustomers,
    { staleTime: 2 * 60_000 }
  );
  const [error, setError] = useState<string | null>(null);

  const createCustomer = useCallback(async (input: {
    name: string; email?: string; phone?: string;
    company?: string; address?: string; notes?: string;
  }): Promise<Customer> => {
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to create customer");
    }
    const customer = await res.json() as Customer;
    // Optimistic prepend
    qc.setData<Customer[]>(["customers"], (prev = []) => [customer, ...prev]);
    return customer;
  }, [qc]);

  const deleteCustomer = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to delete customer");
    }
    qc.setData<Customer[]>(["customers"], (prev = []) => prev.filter((c) => c.id !== id));
  }, [qc]);

  return {
    customers,
    loading: isLoading,
    error,
    refetch: () => qc.invalidate(["customers"]),
    createCustomer,
    deleteCustomer,
  };
}
