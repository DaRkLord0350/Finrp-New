"use client";

import { useQuery, useQueryClient } from "@/lib/queryCache";

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
  totalRevenue: 0, revenueGrowth: 0, activeCustomers: 0,
  invoicesSentThisMonth: 0, overdueInvoices: 0, totalInvoices: 0,
};

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) throw new Error("Failed to load dashboard data");
  return res.json();
}

export function useDashboard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<DashboardData>(
    ["dashboard"],
    fetchDashboard,
    { staleTime: 60_000 }
  );

  return {
    stats:           data?.stats           ?? DEFAULT_STATS,
    recentInvoices:  data?.recentInvoices  ?? [],
    complianceTasks: data?.complianceTasks ?? [],
    lowStockItems:   data?.lowStockItems   ?? [],
    monthlyRevenue:  data?.monthlyRevenue  ?? [],
    loading:         isLoading,
    error:           null as string | null,
    refetch:         () => qc.invalidate(["dashboard"]),
  };
}
