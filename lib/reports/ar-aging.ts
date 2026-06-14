// ============================================================
// AR Aging Summary
// Groups outstanding invoices by days overdue
// ============================================================

import { prisma } from "@/lib/prisma";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult, AgingBucket } from "./types";
import { AR_AGING_BUCKETS } from "./types";

interface ARAging {
  customerId:   string;
  customerName: string;
  current:      number;
  "1-30":       number;
  "31-60":      number;
  "61-90":      number;
  "90+":        number;
  total:        number;
}

export async function generateArAging(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<ARAging>> {
  const today = new Date();
  // AR aging uses today as reference, not a date range filter
  const { endDate } = resolveDateRange(filters);

  const openInvoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status:    { in: ["SENT", "VIEWED", "PARTIAL", "OVERDUE"] },
      deletedAt: null,
      issueDate: { lte: endDate },
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    },
    select: {
      customerId:  true,
      customer:    { select: { name: true } },
      dueDate:     true,
      balanceDue:  true,
    },
  });

  type CustomerBuckets = {
    customerId: string;
    customerName: string;
    buckets: Record<string, number>;
    total: number;
  };

  const customerMap = new Map<string, CustomerBuckets>();

  for (const inv of openInvoices) {
    const balance = Number(inv.balanceDue);
    if (balance <= 0) continue;

    const existing = customerMap.get(inv.customerId) ?? {
      customerId:   inv.customerId,
      customerName: inv.customer.name,
      buckets:      { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
      total:        0,
    };

    const daysOverdue = Math.max(
      0,
      Math.floor((today.getTime() - inv.dueDate.getTime()) / 86_400_000)
    );

    const bucket = getBucket(daysOverdue, AR_AGING_BUCKETS);
    existing.buckets[bucket] = (existing.buckets[bucket] ?? 0) + balance;
    existing.total           += balance;
    customerMap.set(inv.customerId, existing);
  }

  const rows: ARAging[] = Array.from(customerMap.values())
    .map((c) => ({
      customerId:   c.customerId,
      customerName: c.customerName,
      current:      c.buckets["current"] ?? 0,
      "1-30":       c.buckets["1-30"]    ?? 0,
      "31-60":      c.buckets["31-60"]   ?? 0,
      "61-90":      c.buckets["61-90"]   ?? 0,
      "90+":        c.buckets["90+"]     ?? 0,
      total:        c.total,
    }))
    .sort((a, b) => b.total - a.total);

  const totals = {
    current: rows.reduce((s, r) => s + r.current, 0),
    "1-30":  rows.reduce((s, r) => s + r["1-30"], 0),
    "31-60": rows.reduce((s, r) => s + r["31-60"], 0),
    "61-90": rows.reduce((s, r) => s + r["61-90"], 0),
    "90+":   rows.reduce((s, r) => s + r["90+"], 0),
    total:   rows.reduce((s, r) => s + r.total, 0),
  };

  return {
    slug:        "ar-aging",
    name:        "AR Aging Summary",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalCustomers:  rows.length,
      totalOutstanding: totals.total,
      current:         totals.current,
      overdue1to30:    totals["1-30"],
      overdue31to60:   totals["31-60"],
      overdue61to90:   totals["61-90"],
      overdueAbove90:  totals["90+"],
    },
    columns: [
      { key: "customerName", label: "Customer",    type: "text",    sortable: true },
      { key: "current",      label: "Current",     type: "currency",align: "right", sortable: true },
      { key: "1-30",         label: "1–30 days",   type: "currency",align: "right", sortable: true },
      { key: "31-60",        label: "31–60 days",  type: "currency",align: "right", sortable: true },
      { key: "61-90",        label: "61–90 days",  type: "currency",align: "right", sortable: true },
      { key: "90+",          label: "90+ days",    type: "currency",align: "right", sortable: true },
      { key: "total",        label: "Total",       type: "currency",align: "right", sortable: true },
    ],
    rows,
    totals,
    charts: [
      {
        type:  "bar",
        title: "AR Aging Buckets",
        data:  [
          { bucket: "Current",   amount: totals.current   },
          { bucket: "1–30 days", amount: totals["1-30"]   },
          { bucket: "31–60",     amount: totals["31-60"]  },
          { bucket: "61–90",     amount: totals["61-90"]  },
          { bucket: "90+",       amount: totals["90+"]    },
        ],
        xKey:  "bucket",
        yKeys: ["amount"],
      },
    ],
  };
}

function getBucket(days: number, buckets: AgingBucket[]): string {
  const labels: Record<string, string> = {
    "Current":    "current",
    "1–30 days":  "1-30",
    "31–60 days": "31-60",
    "61–90 days": "61-90",
    "> 90 days":  "90+",
  };
  for (const b of buckets) {
    if (days >= b.min && (b.max === -1 || days < b.max)) {
      return labels[b.label] ?? b.label;
    }
  }
  return "90+";
}
