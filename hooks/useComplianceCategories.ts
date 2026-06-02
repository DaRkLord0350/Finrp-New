"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import type {
  ComplianceCategoryRecord,
  ComplianceTypeRecord,
  CreateComplianceCategoryInput,
  CreateComplianceTypeInput,
} from "@/types/compliance";

// ── Categories ──────────────────────────────────────────────────────────────

async function fetchCategories(): Promise<ComplianceCategoryRecord[]> {
  const res = await fetch("/api/compliance/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function useComplianceCategories() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery<ComplianceCategoryRecord[]>(
    ["compliance", "categories"],
    fetchCategories,
    { staleTime: 5 * 60_000 }
  );
  const [error, setError] = useState<string | null>(null);

  const createCategory = useCallback(async (input: CreateComplianceCategoryInput): Promise<ComplianceCategoryRecord> => {
    const res = await fetch("/api/compliance/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed to create category"); }
    const category = await res.json();
    qc.invalidate(["compliance", "categories"]);
    return category;
  }, [qc]);

  const updateCategory = useCallback(async (id: string, updates: Partial<CreateComplianceCategoryInput & { isActive: boolean }>) => {
    const res = await fetch(`/api/compliance/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed to update category"); }
    const updated = await res.json();
    qc.setData<ComplianceCategoryRecord[]>(["compliance", "categories"], (prev = []) => prev.map((c) => c.id === id ? updated : c));
    return updated;
  }, [qc]);

  const deleteCategory = useCallback(async (id: string) => {
    const res = await fetch(`/api/compliance/categories/${id}`, { method: "DELETE" });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed to delete category"); }
    qc.setData<ComplianceCategoryRecord[]>(["compliance", "categories"], (prev = []) => prev.filter((c) => c.id !== id));
  }, [qc]);

  const seedDefaults = useCallback(async () => {
    const res = await fetch("/api/compliance/categories?action=seed", { method: "PUT" });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed to seed categories"); }
    qc.invalidate(["compliance", "categories"]);
  }, [qc]);

  return { categories, loading: isLoading, error, refetch: () => qc.invalidate(["compliance", "categories"]), createCategory, updateCategory, deleteCategory, seedDefaults };
}

// ── Types ────────────────────────────────────────────────────────────────────

async function fetchTypes(categoryId?: string): Promise<ComplianceTypeRecord[]> {
  const query = categoryId ? `?categoryId=${categoryId}` : "";
  const res = await fetch(`/api/compliance/types${query}`);
  if (!res.ok) throw new Error("Failed to fetch compliance types");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function useComplianceTypes(categoryId?: string) {
  const qc = useQueryClient();
  const key = ["compliance", "types", categoryId ?? "all"] as const;
  const { data: types = [], isLoading } = useQuery<ComplianceTypeRecord[]>(
    [...key],
    () => fetchTypes(categoryId),
    { staleTime: 5 * 60_000 }
  );

  const createType = useCallback(async (input: CreateComplianceTypeInput): Promise<ComplianceTypeRecord> => {
    const res = await fetch("/api/compliance/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed to create type"); }
    const type = await res.json();
    qc.invalidate([...key]);
    return type;
  }, [qc, key]);

  const deleteType = useCallback(async (id: string) => {
    const res = await fetch(`/api/compliance/types/${id}`, { method: "DELETE" });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed to delete type"); }
    qc.setData<ComplianceTypeRecord[]>([...key], (prev = []) => prev.filter((t) => t.id !== id));
  }, [qc, key]);

  return { types, loading: isLoading, error: null as string | null, refetch: () => qc.invalidate([...key]), createType, deleteType };
}
