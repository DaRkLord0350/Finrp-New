"use client";

// ============================================================
// useDashboard — Fetch aggregated dashboard stats from DB
// ============================================================

import { useState, useEffect, useCallback } from "react";

export interface DashboardStats {
  totalRevenue: number;
  revenueGrowth: number;
  activeCustomers: number;
  invoicesSentThisMonth: number;
  overdueInvoices: number;
  totalInvoices: number;
}

export interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  total: string | number;
  status: string;
  issueDate: string;
  customer: { name: string } | null;
}

export interface ComplianceTask {
  id: string;
  title: string;
  dueDate: string;
  status: string;
}

export interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  lowStockAt: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  invoices: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentInvoices: RecentInvoice[];
  complianceTasks: ComplianceTask[];
  lowStockItems: LowStockItem[];
  monthlyRevenue: MonthlyRevenue[];
}

const DEFAULT_STATS: DashboardStats = {
  totalRevenue: 0,
  revenueGrowth: 0,
  activeCustomers: 0,
  invoicesSentThisMonth: 0,
  overdueInvoices: 0,
  totalInvoices: 0,
};

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    stats: data?.stats ?? DEFAULT_STATS,
    recentInvoices: data?.recentInvoices ?? [],
    complianceTasks: data?.complianceTasks ?? [],
    lowStockItems: data?.lowStockItems ?? [],
    monthlyRevenue: data?.monthlyRevenue ?? [],
    loading,
    error,
    refetch: fetchDashboard,
  };
}
