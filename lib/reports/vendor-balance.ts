// ============================================================
// Vendor Balance Summary
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface VendorBalanceRow {
  vendorId:          string;
  vendorName:        string;
  totalPurchases:    number;
  purchaseCount:     number;
  paidAmount:        number;
  outstandingBalance: number;
  paymentTermsDays:  number;
}

export async function generateVendorBalance(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<VendorBalanceRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  const rows = await prisma.$queryRaw<{
    vendor_id:          string;
    vendor_name:        string;
    purchase_count:     bigint;
    total_purchases:    string;
    outstanding_balance: string;
    payment_terms:      number;
  }[]>`
    SELECT
      v.id                                           AS vendor_id,
      v.name                                         AS vendor_name,
      COUNT(p.id)::bigint                            AS purchase_count,
      COALESCE(SUM(p."totalAmount"), 0)::text        AS total_purchases,
      v."outstandingBalance"::text                   AS outstanding_balance,
      v."paymentTermsDays"                           AS payment_terms
    FROM vendors v
    LEFT JOIN purchases p
      ON  p."vendorId"       = v.id
      AND p."organizationId" = ${organizationId}
      AND p."purchaseDate"   BETWEEN ${startDate} AND ${endDate}
      AND p."deletedAt"      IS NULL
      AND p.status           != 'CANCELLED'
    WHERE v."organizationId" = ${organizationId}
      AND v."deletedAt"      IS NULL
      ${filters.vendorId ? Prisma.sql`AND v.id = ${filters.vendorId}` : Prisma.empty}
    GROUP BY v.id, v.name, v."outstandingBalance", v."paymentTermsDays"
    ORDER BY v."outstandingBalance" DESC NULLS LAST
  `;

  const mapped: VendorBalanceRow[] = rows.map((r) => ({
    vendorId:          r.vendor_id,
    vendorName:        r.vendor_name,
    totalPurchases:    Number(r.total_purchases),
    purchaseCount:     Number(r.purchase_count),
    paidAmount:        Number(r.total_purchases) - Number(r.outstanding_balance),
    outstandingBalance: Number(r.outstanding_balance),
    paymentTermsDays:  r.payment_terms,
  }));

  const totalPurchases   = mapped.reduce((s, r) => s + r.totalPurchases, 0);
  const totalOutstanding = mapped.reduce((s, r) => s + r.outstandingBalance, 0);

  return {
    slug:        "vendor-balance",
    name:        "Vendor Balance Summary",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalVendors:    mapped.length,
      totalPurchases,
      totalOutstanding,
    },
    columns: [
      { key: "vendorName",        label: "Vendor",          type: "text",    sortable: true },
      { key: "purchaseCount",     label: "Purchases",       type: "number",  align: "right", sortable: true },
      { key: "totalPurchases",    label: "Total Purchased", type: "currency",align: "right", sortable: true },
      { key: "outstandingBalance",label: "Outstanding",     type: "currency",align: "right", sortable: true },
      { key: "paymentTermsDays",  label: "Terms (Days)",    type: "number",  align: "right" },
    ],
    rows: mapped,
    totals: { totalPurchases, totalOutstanding },
  };
}
