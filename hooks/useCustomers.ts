"use client";

import { useEffect, useState } from "react";
import type { Customer } from "@/types";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const createCustomer = async (data: Partial<Customer>) => {
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create customer");
    const customer = await res.json();
    setCustomers((prev) => [customer, ...prev]);
    return customer;
  };

  const deleteCustomer = async (id: string) => {
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete customer");
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  return { customers, loading, error, createCustomer, deleteCustomer, refetch: fetchCustomers };
}
