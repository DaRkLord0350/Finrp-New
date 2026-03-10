"use client";

// ============================================================
// useCustomers — CRUD hook for CRM customers
// ============================================================

import { useState, useEffect, useCallback } from "react";

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  notes?: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { invoices: number };
  // stats derived from invoices
  totalRevenue?: number;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const createCustomer = async (input: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    address?: string;
    notes?: string;
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
    setCustomers((prev) => [customer, ...prev]);
    return customer;
  };

  const deleteCustomer = async (id: string): Promise<void> => {
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to delete customer");
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  return { customers, loading, error, refetch: fetchCustomers, createCustomer, deleteCustomer };
}
