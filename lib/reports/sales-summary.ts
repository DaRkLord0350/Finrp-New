// ============================================================
// Sales Summary Report
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface SalesSummaryRow {
  period:       string;
  invoiceCount: number;
  salesCount:   number;
  totalRevenue: number;
  totalTax:     number;
  totalDiscount: number;
  netRevenue:   number;
}

export async function generateSalesSummary(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<SalesSummaryRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  const [invoiceRows, saleRows] = await Promise.all([
    prisma.$queryRaw<{
      period: string;
      invoice_count: bigint;
      total_revenue: string;
      total_tax: string;
      total_discount: string;
    }[]>`
      SELECT
        TO_CHAR("issueDate", 'YYYY-MM') AS period,
        COUNT(*)::bigint AS invoice_count,
        COALESCE(SUM(total), 0)::text AS total_revenue,
        COALESCE(SUM("taxAmount"), 0)::text AS total_tax,
        COALESCE(SUM(discount), 0)::text AS total_discount
      FROM invoices
      WHERE "organizationId" = ${organizationId}
        AND "issueDate" BETWEEN ${startDate} AND ${endDate}
        AND "deletedAt" IS NULL
        AND status != 'CANCELLED'
      GROUP BY TO_CHAR("issueDate", 'YYYY-MM')
      ORDER BY period
    `,

    prisma.$queryRaw<{
      period: string;
      sale_count: bigint;
      total_amount: string;
      total_tax: string;
      total_discount: string;
    }[]>`
      SELECT
        TO_CHAR("saleDate", 'YYYY-MM') AS period,
        COUNT(*)::bigint AS sale_count,
        COALESCE(SUM("totalAmount"), 0)::text AS total_amount,
        COALESCE(SUM("taxAmount"), 0)::text AS total_tax,
        COALESCE(SUM("discountAmount"), 0)::text AS total_discount
      FROM sales
      WHERE "organizationId" = ${organizationId}
        AND "saleDate" BETWEEN ${startDate} AND ${endDate}
        AND "deletedAt" IS NULL
        AND status != 'CANCELLED'
      GROUP BY TO_CHAR("saleDate", 'YYYY-MM')
      ORDER BY period
    `,
  ]);

  // Merge by period
  const periodMap = new Map<string, SalesSummaryRow>();

  for (const r of invoiceRows) {
    const existing = periodMap.get(r.period) ?? {
      period: r.period,
      invoiceCount: 0,
      salesCount: 0,
      totalRevenue: 0,
      totalTax: 0,
      totalDiscount: 0,
      netRevenue: 0,
    };
    existing.invoiceCount += Number(r.invoice_count);
    existing.totalRevenue += Number(r.total_revenue);
    existing.totalTax     += Number(r.total_tax);
    existing.totalDiscount += Number(r.total_discount);
    periodMap.set(r.period, existing);
  }

  for (const r of saleRows) {
    const existing = periodMap.get(r.period) ?? {
      period: r.period,
      invoiceCount: 0,
      salesCount: 0,
      totalRevenue: 0,
      totalTax: 0,
      totalDiscount: 0,
      netRevenue: 0,
    };
    existing.salesCount += Number(r.sale_count);
    existing.totalRevenue += Number(r.total_amount);
    existing.totalTax     += Number(r.total_tax);
    existing.totalDiscount += Number(r.total_discount);
    periodMap.set(r.period, existing);
  }

  const rows = Array.from(periodMap.values()).map((r) => ({
    ...r,
    netRevenue: r.totalRevenue - r.totalDiscount,
  })).sort((a, b) => a.period.localeCompare(b.period));

  const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
  const totalTax     = rows.reduce((s, r) => s + r.totalTax, 0);
  const totalDiscount = rows.reduce((s, r) => s + r.totalDiscount, 0);

  return {
    slug:        "sales-summary",
    name:        "Sales Summary",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalRevenue,
      totalTax,
      totalDiscount,
      netRevenue: totalRevenue - totalDiscount,
      totalInvoices: rows.reduce((s, r) => s + r.invoiceCount, 0),
      totalSales:    rows.reduce((s, r) => s + r.salesCount, 0),
    },
    columns: [
      { key: "period",       label: "Period",     type: "text", sortable: true },
      { key: "invoiceCount", label: "Invoices",   type: "number", align: "right" },
      { key: "salesCount",   label: "Sales",      type: "number", align: "right" },
      { key: "totalRevenue", label: "Gross",      type: "currency", align: "right", sortable: true },
      { key: "totalDiscount",label: "Discounts",  type: "currency", align: "right" },
      { key: "totalTax",     label: "Tax",        type: "currency", align: "right" },
      { key: "netRevenue",   label: "Net Revenue",type: "currency", align: "right", sortable: true },
    ],
    rows,
    totals: { totalRevenue, totalTax, totalDiscount },
    charts: [
      {
        type:  "bar",
        title: "Monthly Revenue",
        data:  rows.map((r) => ({ name: r.period, revenue: r.totalRevenue, net: r.netRevenue })),
        xKey:  "name",
        yKeys: ["revenue", "net"],
      },
    ],
  };
}
