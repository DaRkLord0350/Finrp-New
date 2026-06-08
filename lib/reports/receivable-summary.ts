// ============================================================
// Receivable Summary Report
// ============================================================

import { prisma } from "@/lib/prisma";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface ReceivableSummaryRow {
  status:      string;
  count:       number;
  totalAmount: number;
  paidAmount:  number;
  balanceDue:  number;
  percentage:  number;
}

export async function generateReceivableSummary(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<ReceivableSummaryRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  const grouped = await prisma.invoice.groupBy({
    by: ["status"],
    where: {
      organizationId,
      issueDate:  { gte: startDate, lte: endDate },
      deletedAt:  null,
    },
    _count: { id: true },
    _sum:   { total: true, paidAmount: true, balanceDue: true },
  });

  const totalAmount = grouped.reduce((s, g) => s + Number(g._sum.total ?? 0), 0);

  const rows: ReceivableSummaryRow[] = grouped.map((g) => ({
    status:      g.status,
    count:       g._count.id,
    totalAmount: Number(g._sum.total ?? 0),
    paidAmount:  Number(g._sum.paidAmount ?? 0),
    balanceDue:  Number(g._sum.balanceDue ?? 0),
    percentage:  totalAmount > 0
      ? Math.round((Number(g._sum.total ?? 0) / totalAmount) * 10000) / 100
      : 0,
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  const [paymentsByMethod] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method"],
      where: {
        organizationId,
        paidAt:    { gte: startDate, lte: endDate },
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  const totalPaid    = rows.reduce((s, r) => s + r.paidAmount, 0);
  const totalBalance = rows.reduce((s, r) => s + r.balanceDue, 0);

  return {
    slug:        "receivable-summary",
    name:        "Receivable Summary",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalInvoices:   rows.reduce((s, r) => s + r.count, 0),
      totalAmount,
      totalPaid,
      totalBalance,
      collectionRate: totalAmount > 0
        ? Math.round((totalPaid / totalAmount) * 10000) / 100
        : 0,
    },
    columns: [
      { key: "status",      label: "Status",       type: "badge",   sortable: true },
      { key: "count",       label: "Count",        type: "number",  align: "right", sortable: true },
      { key: "totalAmount", label: "Total Amount", type: "currency",align: "right", sortable: true },
      { key: "paidAmount",  label: "Paid",         type: "currency",align: "right" },
      { key: "balanceDue",  label: "Balance Due",  type: "currency",align: "right" },
      { key: "percentage",  label: "% of Total",   type: "percent", align: "right" },
    ],
    rows,
    totals: { totalAmount, totalPaid, totalBalance },
    charts: [
      {
        type:  "pie",
        title: "Receivables by Status",
        data:  rows.map((r) => ({ name: r.status, value: r.totalAmount })),
        xKey:  "name",
        yKeys: ["value"],
      },
      {
        type:  "bar",
        title: "Payment Methods",
        data:  paymentsByMethod.map((p) => ({
          method: p.method,
          amount: Number(p._sum.amount ?? 0),
        })),
        xKey:  "method",
        yKeys: ["amount"],
      },
    ],
  };
}
