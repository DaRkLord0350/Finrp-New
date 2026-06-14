// ============================================================
// FinRP Banking OS — Cash Flow Calculator
// Computes daily/monthly snapshots and 90-day linear forecasts.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { CashFlowBreakdown } from "./types";

// ---------------------------------------------------------------------------
// Generate daily snapshot for a given date
// ---------------------------------------------------------------------------
export async function generateDailySnapshot(
  organizationId: string,
  date: Date
): Promise<void> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const result = await prisma.bankTransaction.aggregate({
    where: {
      organizationId,
      transactionDate: { gte: start, lte: end },
      isIgnored: false,
      isDuplicate: false,
    },
    _sum: { credit: true, debit: true },
  });

  const totalInflow = Number(result._sum.credit ?? 0);
  const totalOutflow = Number(result._sum.debit ?? 0);
  const netCashFlow = totalInflow - totalOutflow;

  // Get opening balance (last snapshot before this date)
  const prevSnapshot = await prisma.cashFlowSnapshot.findFirst({
    where: {
      organizationId,
      snapshotDate: { lt: start },
      period: "DAILY",
      isForecast: false,
    },
    orderBy: { snapshotDate: "desc" },
  });
  const openingBalance = prevSnapshot ? Number(prevSnapshot.closingBalance) : 0;

  // Build breakdown
  const txns = await prisma.bankTransaction.findMany({
    where: {
      organizationId,
      transactionDate: { gte: start, lte: end },
      isIgnored: false,
    },
    select: { category: true, credit: true, debit: true, narration: true },
  });

  const breakdown = buildBreakdown(txns);

  await prisma.cashFlowSnapshot.upsert({
    where: { organizationId_snapshotDate_period: { organizationId, snapshotDate: start, period: "DAILY" } },
    create: {
      organizationId,
      snapshotDate: start,
      period: "DAILY",
      totalInflow,
      totalOutflow,
      netCashFlow,
      openingBalance,
      closingBalance: openingBalance + netCashFlow,
      breakdown: breakdown as never,
      isForecast: false,
    },
    update: {
      totalInflow,
      totalOutflow,
      netCashFlow,
      openingBalance,
      closingBalance: openingBalance + netCashFlow,
      breakdown: breakdown as never,
    },
  });
}

// ---------------------------------------------------------------------------
// Generate monthly snapshot
// ---------------------------------------------------------------------------
export async function generateMonthlySnapshot(
  organizationId: string,
  year: number,
  month: number  // 0-based
): Promise<void> {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const result = await prisma.bankTransaction.aggregate({
    where: {
      organizationId,
      transactionDate: { gte: start, lte: end },
      isIgnored: false,
      isDuplicate: false,
    },
    _sum: { credit: true, debit: true },
  });

  const totalInflow = Number(result._sum.credit ?? 0);
  const totalOutflow = Number(result._sum.debit ?? 0);
  const netCashFlow = totalInflow - totalOutflow;

  const prevMonthStart = new Date(year, month - 1, 1);
  const prevSnapshot = await prisma.cashFlowSnapshot.findFirst({
    where: {
      organizationId,
      snapshotDate: { gte: prevMonthStart, lt: start },
      period: "MONTHLY",
      isForecast: false,
    },
    orderBy: { snapshotDate: "desc" },
  });
  const openingBalance = prevSnapshot ? Number(prevSnapshot.closingBalance) : 0;

  const txns = await prisma.bankTransaction.findMany({
    where: {
      organizationId,
      transactionDate: { gte: start, lte: end },
      isIgnored: false,
    },
    select: { category: true, credit: true, debit: true, narration: true },
  });
  const breakdown = buildBreakdown(txns);

  await prisma.cashFlowSnapshot.upsert({
    where: { organizationId_snapshotDate_period: { organizationId, snapshotDate: start, period: "MONTHLY" } },
    create: {
      organizationId,
      snapshotDate: start,
      period: "MONTHLY",
      totalInflow,
      totalOutflow,
      netCashFlow,
      openingBalance,
      closingBalance: openingBalance + netCashFlow,
      breakdown: breakdown as never,
      isForecast: false,
    },
    update: {
      totalInflow,
      totalOutflow,
      netCashFlow,
      openingBalance,
      closingBalance: openingBalance + netCashFlow,
      breakdown: breakdown as never,
    },
  });
}

// ---------------------------------------------------------------------------
// Generate 90-day linear forecast based on last 6 months of data
// ---------------------------------------------------------------------------
export async function generateForecast(
  organizationId: string
): Promise<void> {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(now.getMonth() - 6);

  const history = await prisma.cashFlowSnapshot.findMany({
    where: {
      organizationId,
      period: "MONTHLY",
      isForecast: false,
      snapshotDate: { gte: sixMonthsAgo },
    },
    orderBy: { snapshotDate: "asc" },
  });

  if (history.length < 2) return;

  const inflowValues = history.map(h => Number(h.totalInflow));
  const outflowValues = history.map(h => Number(h.totalOutflow));

  const avgInflow = inflowValues.reduce((a, b) => a + b, 0) / inflowValues.length;
  const avgOutflow = outflowValues.reduce((a, b) => a + b, 0) / outflowValues.length;

  // Simple linear trend
  const inflowTrend = linearTrend(inflowValues);
  const outflowTrend = linearTrend(outflowValues);

  const lastBalance = Number(history[history.length - 1].closingBalance);
  let runningBalance = lastBalance;

  const forecasts: Array<{
    snapshotDate: Date;
    totalInflow: number;
    totalOutflow: number;
    netCashFlow: number;
    openingBalance: number;
    closingBalance: number;
  }> = [];

  for (let i = 1; i <= 3; i++) {
    const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const projectedInflow = Math.max(0, avgInflow + inflowTrend * i);
    const projectedOutflow = Math.max(0, avgOutflow + outflowTrend * i);
    const net = projectedInflow - projectedOutflow;

    forecasts.push({
      snapshotDate: forecastDate,
      totalInflow: projectedInflow,
      totalOutflow: projectedOutflow,
      netCashFlow: net,
      openingBalance: runningBalance,
      closingBalance: runningBalance + net,
    });
    runningBalance += net;
  }

  for (const f of forecasts) {
    await prisma.cashFlowSnapshot.upsert({
      where: { organizationId_snapshotDate_period: { organizationId, snapshotDate: f.snapshotDate, period: "MONTHLY" } },
      create: { organizationId, period: "MONTHLY", isForecast: true, ...f },
      update: { isForecast: true, ...f },
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function linearTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const last = values[n - 1];
  const first = values[0];
  return (last - first) / (n - 1);
}

function buildBreakdown(txns: Array<{
  category: string | null;
  credit: { toString(): string } | null;
  debit: { toString(): string } | null;
  narration: string;
}>): CashFlowBreakdown {
  const categories: Record<string, { inflow: number; outflow: number }> = {};
  const creditorMap: Record<string, number> = {};
  const debitorMap: Record<string, number> = {};

  for (const t of txns) {
    const cat = t.category ?? "Uncategorized";
    if (!categories[cat]) categories[cat] = { inflow: 0, outflow: 0 };

    const credit = Number(t.credit ?? 0);
    const debit = Number(t.debit ?? 0);

    if (credit > 0) {
      categories[cat].inflow += credit;
      const key = t.narration.slice(0, 30);
      creditorMap[key] = (creditorMap[key] ?? 0) + credit;
    }
    if (debit > 0) {
      categories[cat].outflow += debit;
      const key = t.narration.slice(0, 30);
      debitorMap[key] = (debitorMap[key] ?? 0) + debit;
    }
  }

  const topCreditors = Object.entries(creditorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  const topDebitors = Object.entries(debitorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  return { categories, topCreditors, topDebitors };
}

// ---------------------------------------------------------------------------
// Recompute all monthly snapshots for the last N months
// ---------------------------------------------------------------------------
export async function rebuildMonthlySnapshots(
  organizationId: string,
  months = 12
): Promise<void> {
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    await generateMonthlySnapshot(organizationId, now.getFullYear(), now.getMonth() - i);
  }
  await generateForecast(organizationId);
}
