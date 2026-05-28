"use client";

import { useState, useEffect, useCallback } from "react";
import type { ComplianceAuditLogRecord } from "@/types/compliance";

interface AuditLogsState {
  logs: ComplianceAuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

interface AuditLogsParams {
  submissionId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

export function useComplianceAuditLogs(initialParams: AuditLogsParams = {}) {
  const [params, setParams] = useState<AuditLogsParams>({ pageSize: 25, ...initialParams });
  const [state, setState] = useState<AuditLogsState>({
    logs: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
    loading: true,
    error: null,
  });

  const fetchLogs = useCallback(async (p: AuditLogsParams) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const query = new URLSearchParams();
      if (p.submissionId) query.set("submissionId", p.submissionId);
      if (p.action) query.set("action", p.action);
      if (p.page) query.set("page", String(p.page));
      if (p.pageSize) query.set("pageSize", String(p.pageSize));

      const res = await fetch(`/api/compliance/audit-logs?${query}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setState({
        logs: data.data ?? [],
        total: data.total ?? 0,
        page: data.page ?? 1,
        pageSize: data.pageSize ?? 25,
        totalPages: data.totalPages ?? 0,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load audit logs",
      }));
    }
  }, []);

  useEffect(() => {
    fetchLogs(params);
  }, [fetchLogs, params]);

  const updateParams = useCallback((updates: Partial<AuditLogsParams>) => {
    setParams((p) => ({
      ...p,
      ...updates,
      page: updates.page ?? 1,
    }));
  }, []);

  return {
    logs: state.logs,
    pagination: {
      total: state.total,
      page: state.page,
      pageSize: state.pageSize,
      totalPages: state.totalPages,
    },
    loading: state.loading,
    error: state.error,
    params,
    updateParams,
    refetch: () => fetchLogs(params),
  };
}
