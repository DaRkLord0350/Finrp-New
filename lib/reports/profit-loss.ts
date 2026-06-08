// ============================================================
// Profit & Loss Report
// Revenue = SUM(invoices.total WHERE status=PAID) + SUM(sales.totalAmount WHERE status=COMPLETED)
// Expenses = SUM(expenses.amount) + SUM(purchases.totalAmount WHERE received)
// ============================================================

import { prisma } from "@/lib/prisma";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface PLRow {
  category: string;
  label: string;
  amount: number;
  type: "income" | "expense";
}

export async function generateProfitLoss(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<PLRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  const [invoiceRevenue, salesRevenue, expenseRows, purchaseCost] = await Promise.all([
    // Invoice revenue (paid invoices)
    prisma.invoice.aggregate({
      where: {
        organizationId,
        status: "PAID",
        issueDate: { gte: startDate, lte: endDate },
        deletedAt: null,
      },
      _sum: { total: true },
    }),

    // ERP sales revenue
    prisma.sale.aggregate({
      where: {
        organizationId,
        status: "COMPLETED",
        saleDate: { gte: startDate, lte: endDate },
        deletedAt: null,
      },
      _sum: { totalAmount: true },
    }),

    // Expenses grouped by category
    prisma.expense.groupBy({
      by: ["category"],
      where: {
        organizationId,
        expenseDate: { gte: startDate, lte: endDate },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),

    // Purchases cost (received/partially received)
    prisma.purchase.aggregate({
      where: {
        organizationId,
        status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] },
        purchaseDate: { gte: startDate, lte: endDate },
        deletedAt: null,
      },
      _sum: { totalAmount: true },
    }),
  ]);

  const invoiceRev = Number(invoiceRevenue._sum.total ?? 0);
  const salesRev = Number(salesRevenue._sum.totalAmount ?? 0);
  const totalRevenue = invoiceRev + salesRev;

  const expenseTotal = expenseRows.reduce(
    (s, r) => s + Number(r._sum.amount ?? 0),
    0
  );
  const purchaseTotal = Number(purchaseCost._sum.totalAmount ?? 0);
  const totalExpenses = expenseTotal + purchaseTotal;

  const grossProfit = totalRevenue;
  const netProfit = totalRevenue - totalExpenses;

  const rows: PLRow[] = [
    { category: "Income", label: "Invoice Revenue (Paid)",    amount: invoiceRev,    type: "income" },
    { category: "Income", label: "Sales Revenue",            amount: salesRev,      type: "income" },
    ...expenseRows.map((r) => ({
      category: "Expenses",
      label:    r.category.charAt(0) + r.category.slice(1).toLowerCase().replace("_", " "),
      amount:   Number(r._sum.amount ?? 0),
      type:     "expense" as const,
    })),
    { category: "Expenses", label: "Cost of Purchases",  amount: purchaseTotal, type: "expense" },
  ];

  return {
    slug:        "profit-loss",
    name:        "Profit & Loss",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalRevenue,
      totalExpenses,
      grossProfit,
      netProfit,
      profitMargin: totalRevenue > 0
        ? Math.round((netProfit / totalRevenue) * 10000) / 100
        : 0,
    },
    columns: [
      { key: "category", label: "Category", type: "text" },
      { key: "label",    label: "Description", type: "text" },
      { key: "amount",   label: "Amount", type: "currency", align: "right", sortable: true },
      { key: "type",     label: "Type",   type: "badge" },
    ],
    rows,
    totals: {
      totalRevenue,
      totalExpenses,
      netProfit,
    },
    charts: [
      {
        type:  "bar",
        title: "Revenue vs Expenses",
        data:  [
          { name: "Revenue",  value: totalRevenue  },
          { name: "Expenses", value: totalExpenses },
          { name: "Net Profit", value: netProfit   },
        ],
        xKey:  "name",
        yKeys: ["value"],
      },
    ],
  };
}
