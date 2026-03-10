"use client";

// ============================================================
// useBusiness — Fetch/update current user's business profile
// ============================================================

import { useState, useEffect } from "react";

export interface Business {
  id: string;
  clerkId: string;
  name: string;
  type: string;
  industry: string;
  address: string;
  country: string;
  currency: string;
  taxId?: string | null;
  createdAt: string;
}

export function useBusiness() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBusiness = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/business");
      if (!res.ok) throw new Error("Failed to fetch business");
      const data = await res.json();
      setBusiness(data.business ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusiness();
  }, []);

  const updateBusiness = async (input: Partial<Omit<Business, "id" | "clerkId" | "createdAt">>) => {
    const res = await fetch("/api/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to update business");
    }
    const data = await res.json();
    setBusiness(data.business);
    return data.business as Business;
  };

  return { business, loading, error, refetch: fetchBusiness, updateBusiness };
}
