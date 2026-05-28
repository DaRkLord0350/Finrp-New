"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ComplianceSubmissionRecord,
  SubmissionsQueryParams,
  PaginatedResult,
  CreateComplianceSubmissionInput,
  UpdateComplianceSubmissionInput,
  ApproveComplianceInput,
} from "@/types/compliance";

export function useComplianceSubmissions(initialParams?: SubmissionsQueryParams) {
  const [result, setResult] = useState<PaginatedResult<ComplianceSubmissionRecord>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<SubmissionsQueryParams>(initialParams ?? {});

  const buildQuery = useCallback((p: SubmissionsQueryParams) => {
    const q = new URLSearchParams();
    if (p.status) q.set("status", p.status);
    if (p.categoryId) q.set("categoryId", p.categoryId);
    if (p.typeId) q.set("typeId", p.typeId);
    if (p.search) q.set("search", p.search);
    if (p.page) q.set("page", String(p.page));
    if (p.pageSize) q.set("pageSize", String(p.pageSize));
    if (p.sortBy) q.set("sortBy", p.sortBy);
    if (p.sortOrder) q.set("sortOrder", p.sortOrder);
    return q.toString();
  }, []);

  const fetchSubmissions = useCallback(
    async (overrideParams?: SubmissionsQueryParams) => {
      const p = overrideParams ?? params;
      try {
        setLoading(true);
        setError(null);
        const query = buildQuery(p);
        const res = await fetch(`/api/compliance/submissions${query ? `?${query}` : ""}`);
        if (!res.ok) throw new Error("Failed to fetch compliance submissions");
        const data = await res.json();
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [params, buildQuery]
  );

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const updateParams = useCallback((updates: Partial<SubmissionsQueryParams>) => {
    setParams((prev) => ({ ...prev, ...updates, page: 1 }));
  }, []);

  const createSubmission = useCallback(
    async (input: CreateComplianceSubmissionInput): Promise<ComplianceSubmissionRecord> => {
      const res = await fetch("/api/compliance/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create submission");
      }
      const submission = await res.json();
      fetchSubmissions();
      return submission;
    },
    [fetchSubmissions]
  );

  const updateSubmission = useCallback(
    async (
      id: string,
      input: UpdateComplianceSubmissionInput
    ): Promise<ComplianceSubmissionRecord> => {
      const res = await fetch(`/api/compliance/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update submission");
      }
      const updated = await res.json();
      setResult((prev) => ({
        ...prev,
        data: prev.data.map((s) => (s.id === id ? { ...s, ...updated } : s)),
      }));
      return updated;
    },
    []
  );

  const deleteSubmission = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/compliance/submissions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to delete submission");
    }
    setResult((prev) => ({
      ...prev,
      data: prev.data.filter((s) => s.id !== id),
      total: prev.total - 1,
    }));
  }, []);

  const approveSubmission = useCallback(
    async (id: string, input: ApproveComplianceInput): Promise<void> => {
      const res = await fetch(`/api/compliance/submissions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to process approval");
      }
      fetchSubmissions();
    },
    [fetchSubmissions]
  );

  return {
    submissions: result.data,
    pagination: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    },
    loading,
    error,
    params,
    updateParams,
    refetch: fetchSubmissions,
    createSubmission,
    updateSubmission,
    deleteSubmission,
    approveSubmission,
  };
}
