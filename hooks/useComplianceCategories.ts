"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ComplianceCategoryRecord,
  ComplianceTypeRecord,
  CreateComplianceCategoryInput,
  CreateComplianceTypeInput,
} from "@/types/compliance";

export function useComplianceCategories() {
  const [categories, setCategories] = useState<ComplianceCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/compliance/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = useCallback(
    async (input: CreateComplianceCategoryInput): Promise<ComplianceCategoryRecord> => {
      const res = await fetch("/api/compliance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create category");
      }
      const category = await res.json();
      setCategories((prev) => [...prev, category]);
      return category;
    },
    []
  );

  const updateCategory = useCallback(
    async (id: string, updates: Partial<CreateComplianceCategoryInput & { isActive: boolean }>) => {
      const res = await fetch(`/api/compliance/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update category");
      }
      const updated = await res.json();
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    []
  );

  const deleteCategory = useCallback(async (id: string) => {
    const res = await fetch(`/api/compliance/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to delete category");
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const seedDefaults = useCallback(async () => {
    const res = await fetch("/api/compliance/categories?action=seed", { method: "PUT" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to seed default categories");
    }
    await fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    seedDefaults,
  };
}

export function useComplianceTypes(categoryId?: string) {
  const [types, setTypes] = useState<ComplianceTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const query = categoryId ? `?categoryId=${categoryId}` : "";
      const res = await fetch(`/api/compliance/types${query}`);
      if (!res.ok) throw new Error("Failed to fetch compliance types");
      const data = await res.json();
      setTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const createType = useCallback(
    async (input: CreateComplianceTypeInput): Promise<ComplianceTypeRecord> => {
      const res = await fetch("/api/compliance/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create type");
      }
      const type = await res.json();
      setTypes((prev) => [...prev, type]);
      return type;
    },
    []
  );

  const deleteType = useCallback(async (id: string) => {
    const res = await fetch(`/api/compliance/types/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to delete type");
    }
    setTypes((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { types, loading, error, refetch: fetchTypes, createType, deleteType };
}
