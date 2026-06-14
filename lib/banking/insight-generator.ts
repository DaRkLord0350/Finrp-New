// ============================================================
// FinRP Banking OS — AI Insight Generator
// Generates actionable banking insights using Gemini + heuristics.
// Stores results in BankAIInsight; deduplicates by type + window.
// ============================================================

import { prisma } from "@/lib/prisma";
import { getGeminiModel } from "@/lib/gemini";
import type { InsightPayload } from "./types";

// ---------------------------------------------------------------------------
// Main entry point — run all insight checks for an org
// ---------------------------------------------------------------------------
export async function runInsightGeneration(organizationId: string): Promise<void> {
  const results = await Promise.allSettled([
    generateCashFlowInsight(organizationId),
    generateExpenseTrendInsight(organizationId),
    generateGSTInsight(organizationId),
    generateLiquidityWarning(organizationId),
    generateVendorConcentrationInsight(organizationId),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[insights] generator failed:", r.reason?.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Cash flow alert (low or negative net cash flow this month)
// ---------------------------------------------------------------------------
async function generateCashFlowInsight(organizationId: string): Promise<void> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const agg = await prisma.bankTransaction.aggregate({
    where: { organizationId, transactionDate: { gte: monthStart }, isIgnored: false },
    _sum: { credit: true, debit: true },
  });

  const inflow = Number(agg._sum.credit ?? 0);
  const outflow = Number(agg._sum.debit ?? 0);
  const net = inflow - outflow;

  if (net >= 0 && outflow < inflow * 0.9) return;

  const severity = net < -100_000 ? "HIGH" : "MEDIUM";
  const title = net < 0
    ? "Negative Cash Flow This Month"
    : "Cash Outflow Approaching Inflow";
  const summary = net < 0
    ? `You have spent ₹${Math.abs(net).toLocaleString("en-IN")} more than you received this month.`
    : `Monthly outflows (₹${outflow.toLocaleString("en-IN")}) are close to inflows (₹${inflow.toLocaleString("en-IN")}).`;

  await upsertInsight(organizationId, {
    insightType: "CASH_FLOW_ALERT",
    title,
    summary,
    severity,
    actionRequired: net < 0,
    actionLabel: "View Cash Flow",
    actionUrl: "/banking/cash-flow",
    validUntil: endOfMonth(),
    data: { inflow, outflow, net },
  });
}

// ---------------------------------------------------------------------------
// Expense trend — detect sharp rise in spending vs prior month
// ---------------------------------------------------------------------------
async function generateExpenseTrendInsight(organizationId: string): Promise<void> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [thisMo, lastMo] = await Promise.all([
    prisma.bankTransaction.aggregate({
      where: { organizationId, transactionDate: { gte: thisMonthStart }, isIgnored: false },
      _sum: { debit: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { organizationId, transactionDate: { gte: lastMonthStart, lte: lastMonthEnd }, isIgnored: false },
      _sum: { debit: true },
    }),
  ]);

  const thisOutflow = Number(thisMo._sum.debit ?? 0);
  const lastOutflow = Number(lastMo._sum.debit ?? 0);
  if (lastOutflow === 0 || thisOutflow === 0) return;

  const changePercent = ((thisOutflow - lastOutflow) / lastOutflow) * 100;
  if (changePercent < 20) return;

  await upsertInsight(organizationId, {
    insightType: "EXPENSE_TREND",
    title: `Expenses Up ${changePercent.toFixed(0)}% vs Last Month`,
    summary: `Your spending this month (₹${thisOutflow.toLocaleString("en-IN")}) is significantly higher than last month (₹${lastOutflow.toLocaleString("en-IN")}).`,
    severity: changePercent > 50 ? "HIGH" : "MEDIUM",
    actionLabel: "View Transactions",
    actionUrl: "/banking/transactions",
    validUntil: endOfMonth(),
    data: { thisOutflow, lastOutflow, changePercent },
  });
}

// ---------------------------------------------------------------------------
// GST payment due alert (25th of each month)
// ---------------------------------------------------------------------------
async function generateGSTInsight(organizationId: string): Promise<void> {
  const now = new Date();
  const dayOfMonth = now.getDate();
  if (dayOfMonth < 15 || dayOfMonth > 28) return; // only relevant mid-to-late month

  // Check if GST payment was made this month
  const gstPaid = await prisma.bankTransaction.findFirst({
    where: {
      organizationId,
      transactionDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      txnType: "GST_PAYMENT",
    },
  });

  if (gstPaid) return;

  await upsertInsight(organizationId, {
    insightType: "GST_ALERT",
    title: "GST Payment May Be Due",
    summary: "No GST payment transaction detected this month. Ensure your GSTR-3B is filed and payment made by the 20th.",
    severity: dayOfMonth > 20 ? "HIGH" : "MEDIUM",
    actionRequired: true,
    actionLabel: "Check GST Transactions",
    actionUrl: "/banking/gst-match",
    validUntil: endOfMonth(),
    data: { dayOfMonth },
  });
}

// ---------------------------------------------------------------------------
// Liquidity warning — projected negative balance in 30 days
// ---------------------------------------------------------------------------
async function generateLiquidityWarning(organizationId: string): Promise<void> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const [accounts, recentAgg] = await Promise.all([
    prisma.bankAccount.aggregate({
      where: { organizationId, isActive: true },
      _sum: { availableBalance: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { organizationId, transactionDate: { gte: thirtyDaysAgo }, isIgnored: false },
      _sum: { credit: true, debit: true },
    }),
  ]);

  const totalBalance = Number(accounts._sum.availableBalance ?? 0);
  const avgDailyOutflow = Number(recentAgg._sum.debit ?? 0) / 30;
  const avgDailyInflow = Number(recentAgg._sum.credit ?? 0) / 30;
  const dailyNet = avgDailyInflow - avgDailyOutflow;

  if (dailyNet >= 0) return;

  const daysToZero = dailyNet < 0 ? Math.floor(totalBalance / Math.abs(dailyNet)) : Infinity;
  if (daysToZero > 60) return;

  await upsertInsight(organizationId, {
    insightType: "LIQUIDITY_WARNING",
    title: `Cash Reserves May Run Low in ~${daysToZero} Days`,
    summary: `At the current burn rate of ₹${Math.abs(dailyNet).toLocaleString("en-IN")}/day, your available balance of ₹${totalBalance.toLocaleString("en-IN")} may be depleted in ~${daysToZero} days.`,
    severity: daysToZero < 15 ? "CRITICAL" : daysToZero < 30 ? "HIGH" : "MEDIUM",
    actionRequired: true,
    actionLabel: "View Cash Flow Forecast",
    actionUrl: "/banking/cash-flow",
    validUntil: daysAfterNow(7),
    data: { totalBalance, avgDailyOutflow, avgDailyInflow, daysToZero },
  });
}

// ---------------------------------------------------------------------------
// Vendor concentration risk — top vendor > 40% of total outflows
// ---------------------------------------------------------------------------
async function generateVendorConcentrationInsight(organizationId: string): Promise<void> {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const txns = await prisma.bankTransaction.findMany({
    where: {
      organizationId,
      transactionDate: { gte: threeMonthsAgo },
      isIgnored: false,
      debit: { gt: 0 },
    },
    select: { narration: true, debit: true },
  });

  const totalOutflow = txns.reduce((s, t) => s + Number(t.debit), 0);
  if (totalOutflow === 0) return;

  const narrationMap: Record<string, number> = {};
  for (const t of txns) {
    const key = t.narration.slice(0, 30).trim();
    narrationMap[key] = (narrationMap[key] ?? 0) + Number(t.debit);
  }

  const topEntry = Object.entries(narrationMap).sort((a, b) => b[1] - a[1])[0];
  if (!topEntry) return;

  const [topName, topAmount] = topEntry;
  const concentration = (topAmount / totalOutflow) * 100;
  if (concentration < 40) return;

  await upsertInsight(organizationId, {
    insightType: "VENDOR_ANALYSIS",
    title: `High Vendor Concentration Risk`,
    summary: `"${topName}" accounts for ${concentration.toFixed(0)}% of outflows (₹${topAmount.toLocaleString("en-IN")}) in the last 3 months. Consider diversifying.`,
    severity: concentration > 60 ? "HIGH" : "MEDIUM",
    data: { topName, topAmount, totalOutflow, concentration },
    validUntil: daysAfterNow(30),
  });
}

// ---------------------------------------------------------------------------
// Upsert helper — prevent duplicate insights for same type this month
// ---------------------------------------------------------------------------
async function upsertInsight(
  organizationId: string,
  payload: InsightPayload
): Promise<void> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 7);

  const existing = await prisma.bankAIInsight.findFirst({
    where: {
      organizationId,
      insightType: payload.insightType as never,
      isDismissed: false,
      createdAt: { gte: sinceDate },
    },
  });

  if (existing) {
    await prisma.bankAIInsight.update({
      where: { id: existing.id },
      data: {
        title: payload.title,
        summary: payload.summary,
        detail: payload.detail,
        severity: payload.severity,
        data: payload.data as never,
        actionRequired: payload.actionRequired ?? false,
        actionLabel: payload.actionLabel,
        actionUrl: payload.actionUrl,
        validUntil: payload.validUntil,
        isRead: false,
      },
    });
    return;
  }

  await prisma.bankAIInsight.create({
    data: {
      organizationId,
      insightType: payload.insightType as never,
      title: payload.title,
      summary: payload.summary,
      detail: payload.detail,
      severity: payload.severity,
      data: payload.data as never,
      actionRequired: payload.actionRequired ?? false,
      actionLabel: payload.actionLabel,
      actionUrl: payload.actionUrl,
      validUntil: payload.validUntil,
    },
  });
}

// ---------------------------------------------------------------------------
// Generate a natural-language insight via Gemini for custom questions
// ---------------------------------------------------------------------------
export async function generateAIInsightText(
  organizationId: string,
  question: string
): Promise<string> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [agg, topCats] = await Promise.all([
    prisma.bankTransaction.aggregate({
      where: { organizationId, transactionDate: { gte: monthStart } },
      _sum: { credit: true, debit: true },
      _count: true,
    }),
    prisma.bankTransaction.groupBy({
      by: ["category"],
      where: { organizationId, transactionDate: { gte: monthStart } },
      _sum: { debit: true },
      orderBy: { _sum: { debit: "desc" } },
      take: 5,
    }),
  ]);

  const context = `
Monthly Stats:
- Total Inflow: ₹${Number(agg._sum.credit ?? 0).toLocaleString("en-IN")}
- Total Outflow: ₹${Number(agg._sum.debit ?? 0).toLocaleString("en-IN")}
- Transaction Count: ${agg._count}
- Top Expense Categories: ${topCats.map(c => `${c.category ?? "Uncategorized"} (₹${Number(c._sum.debit ?? 0).toLocaleString("en-IN")})`).join(", ")}
  `;

  const model = getGeminiModel();
  const result = await model.generateContent([
    { text: `You are a banking assistant for an Indian SME. Context:\n${context}` },
    { text: question },
  ]);
  return result.response.text();
}

function endOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
}

function daysAfterNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
