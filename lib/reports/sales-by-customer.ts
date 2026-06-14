// ============================================================
// Sales by Customer Report
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface SalesByCustomerRow {
  customerId:    string;
  customerName:  string;
  invoiceCount:  number;
  totalInvoiced: number;
  totalPaid:     number;
  totalBalance:  number;
  lastSaleDate:  string;
}

export async function generateSalesByCustomer(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<SalesByCustomerRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  const rows = await prisma.$queryRaw<{
    customer_id:    string;
    customer_name:  string;
    invoice_count:  bigint;
    total_invoiced: string;
    total_paid:     string;
    total_balance:  string;
    last_sale_date: Date | null;
  }[]>`
    SELECT
      c.id                                   AS customer_id,
      c.name                                 AS customer_name,
      COUNT(i.id)::bigint                    AS invoice_count,
      COALESCE(SUM(i.total), 0)::text        AS total_invoiced,
      COALESCE(SUM(i."paidAmount"), 0)::text AS total_paid,
      COALESCE(SUM(i."balanceDue"), 0)::text AS total_balance,
      MAX(i."issueDate")                     AS last_sale_date
    FROM customers c
    LEFT JOIN invoices i
      ON  i."customerId"     = c.id
      AND i."organizationId" = ${organizationId}
      AND i."issueDate"      BETWEEN ${startDate} AND ${endDate}
      AND i."deletedAt"      IS NULL
      AND i.status           != 'CANCELLED'
    WHERE c."organizationId" = ${organizationId}
      AND c."deletedAt"      IS NULL
      ${filters.customerId ? Prisma.sql`AND c.id = ${filters.customerId}` : Prisma.empty}
    GROUP BY c.id, c.name
    HAVING COUNT(i.id) > 0
    ORDER BY SUM(i.total) DESC NULLS LAST
  `;

  const mapped: SalesByCustomerRow[] = rows.map((r) => ({
    customerId:    r.customer_id,
    customerName:  r.customer_name,
    invoiceCount:  Number(r.invoice_count),
    totalInvoiced: Number(r.total_invoiced),
    totalPaid:     Number(r.total_paid),
    totalBalance:  Number(r.total_balance),
    lastSaleDate:  r.last_sale_date
      ? new Date(r.last_sale_date).toISOString().split("T")[0]
      : "",
  }));

  const totalInvoiced = mapped.reduce((s, r) => s + r.totalInvoiced, 0);
  const totalPaid     = mapped.reduce((s, r) => s + r.totalPaid, 0);
  const totalBalance  = mapped.reduce((s, r) => s + r.totalBalance, 0);

  return {
    slug:        "sales-by-customer",
    name:        "Sales by Customer",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalCustomers: mapped.length,
      totalInvoiced,
      totalPaid,
      totalBalance,
    },
    columns: [
      { key: "customerName",  label: "Customer",       type: "text",     sortable: true },
      { key: "invoiceCount",  label: "Invoices",       type: "number",   align: "right", sortable: true },
      { key: "totalInvoiced", label: "Invoiced",       type: "currency", align: "right", sortable: true },
      { key: "totalPaid",     label: "Paid",           type: "currency", align: "right", sortable: true },
      { key: "totalBalance",  label: "Balance Due",    type: "currency", align: "right", sortable: true },
      { key: "lastSaleDate",  label: "Last Sale",      type: "date",     sortable: true },
    ],
    rows: mapped,
    totals: { totalInvoiced, totalPaid, totalBalance },
    charts: [
      {
        type:  "bar",
        title: "Top Customers by Revenue",
        data:  mapped.slice(0, 10).map((r) => ({
          name:    r.customerName,
          revenue: r.totalInvoiced,
        })),
        xKey:  "name",
        yKeys: ["revenue"],
      },
    ],
  };
}
