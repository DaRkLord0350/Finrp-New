// ============================================================
// Customer Balance Summary
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface CustomerBalanceRow {
  customerId:      string;
  customerName:    string;
  totalInvoiced:   number;
  totalPaid:       number;
  creditNotes:     number;
  outstandingBalance: number;
  creditLimit:     number;
  availableCredit: number;
}

export async function generateCustomerBalance(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<CustomerBalanceRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  const rows = await prisma.$queryRaw<{
    customer_id:      string;
    customer_name:    string;
    total_invoiced:   string;
    total_paid:       string;
    balance_due:      string;
    credit_limit:     string;
  }[]>`
    SELECT
      c.id                                          AS customer_id,
      c.name                                        AS customer_name,
      COALESCE(SUM(i.total), 0)::text               AS total_invoiced,
      COALESCE(SUM(i."paidAmount"), 0)::text        AS total_paid,
      COALESCE(SUM(i."balanceDue"), 0)::text        AS balance_due,
      c."creditLimit"::text                         AS credit_limit
    FROM customers c
    LEFT JOIN invoices i
      ON  i."customerId"     = c.id
      AND i."organizationId" = ${organizationId}
      AND i."issueDate"      BETWEEN ${startDate} AND ${endDate}
      AND i."deletedAt"      IS NULL
      AND i.status           NOT IN ('CANCELLED','DRAFT')
    WHERE c."organizationId" = ${organizationId}
      AND c."deletedAt"      IS NULL
      ${filters.customerId ? Prisma.sql`AND c.id = ${filters.customerId}` : Prisma.empty}
    GROUP BY c.id, c.name, c."creditLimit"
    ORDER BY SUM(i."balanceDue") DESC NULLS LAST
  `;

  const mapped: CustomerBalanceRow[] = rows.map((r) => {
    const creditLimit = Number(r.credit_limit);
    const balance     = Number(r.balance_due);
    return {
      customerId:      r.customer_id,
      customerName:    r.customer_name,
      totalInvoiced:   Number(r.total_invoiced),
      totalPaid:       Number(r.total_paid),
      creditNotes:     0,
      outstandingBalance: balance,
      creditLimit,
      availableCredit: Math.max(0, creditLimit - balance),
    };
  });

  const totalOutstanding = mapped.reduce((s, r) => s + r.outstandingBalance, 0);
  const totalInvoiced    = mapped.reduce((s, r) => s + r.totalInvoiced, 0);
  const totalPaid        = mapped.reduce((s, r) => s + r.totalPaid, 0);

  return {
    slug:        "customer-balance",
    name:        "Customer Balance Summary",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalCustomers: mapped.length,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
    },
    columns: [
      { key: "customerName",      label: "Customer",          type: "text",    sortable: true },
      { key: "totalInvoiced",     label: "Total Invoiced",    type: "currency",align: "right", sortable: true },
      { key: "totalPaid",         label: "Total Paid",        type: "currency",align: "right" },
      { key: "outstandingBalance",label: "Outstanding",       type: "currency",align: "right", sortable: true },
      { key: "creditLimit",       label: "Credit Limit",      type: "currency",align: "right" },
      { key: "availableCredit",   label: "Available Credit",  type: "currency",align: "right" },
    ],
    rows: mapped,
    totals: { totalInvoiced, totalPaid, totalOutstanding },
  };
}
