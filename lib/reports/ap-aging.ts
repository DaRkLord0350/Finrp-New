// ============================================================
// AP Aging Summary — Vendor payables grouped by age
// ============================================================

import { prisma } from "@/lib/prisma";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface APAgingRow {
  vendorId:    string;
  vendorName:  string;
  current:     number;
  "1-30":      number;
  "31-60":     number;
  "61-90":     number;
  "90+":       number;
  total:       number;
}

export async function generateApAging(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<APAgingRow>> {
  const today = new Date();
  const { endDate } = resolveDateRange(filters);

  const openPurchases = await prisma.purchase.findMany({
    where: {
      organizationId,
      paymentStatus: { in: ["PENDING", "PARTIAL"] },
      deletedAt:     null,
      purchaseDate:  { lte: endDate },
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    },
    select: {
      vendorId:     true,
      vendorName:   true,
      vendor:       { select: { name: true } },
      totalAmount:  true,
      purchaseDate: true,
      expectedDelivery: true,
    },
  });

  type VendorBuckets = {
    vendorId:   string;
    vendorName: string;
    buckets:    Record<string, number>;
    total:      number;
  };

  const vendorMap = new Map<string, VendorBuckets>();

  for (const p of openPurchases) {
    const amount   = Number(p.totalAmount);
    const vid      = p.vendorId ?? "unknown";
    const vname    = p.vendor?.name ?? p.vendorName ?? "Unknown Vendor";
    // Use purchaseDate + 30-day default terms as due date proxy
    const dueDate  = p.expectedDelivery ?? new Date(p.purchaseDate.getTime() + 30 * 86_400_000);
    const daysOverdue = Math.max(
      0,
      Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)
    );

    const existing = vendorMap.get(vid) ?? {
      vendorId:   vid,
      vendorName: vname,
      buckets:    { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
      total:      0,
    };

    const bucket = getApBucket(daysOverdue);
    existing.buckets[bucket] = (existing.buckets[bucket] ?? 0) + amount;
    existing.total           += amount;
    vendorMap.set(vid, existing);
  }

  const rows: APAgingRow[] = Array.from(vendorMap.values())
    .map((v) => ({
      vendorId:    v.vendorId,
      vendorName:  v.vendorName,
      current:     v.buckets["current"] ?? 0,
      "1-30":      v.buckets["1-30"]    ?? 0,
      "31-60":     v.buckets["31-60"]   ?? 0,
      "61-90":     v.buckets["61-90"]   ?? 0,
      "90+":       v.buckets["90+"]     ?? 0,
      total:       v.total,
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
    slug:        "ap-aging",
    name:        "AP Aging Summary",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalVendors:    rows.length,
      totalOutstanding: totals.total,
      current:         totals.current,
      overdue1to30:    totals["1-30"],
      overdue31to60:   totals["31-60"],
      overdue61to90:   totals["61-90"],
      overdueAbove90:  totals["90+"],
    },
    columns: [
      { key: "vendorName", label: "Vendor",       type: "text",    sortable: true },
      { key: "current",    label: "Current",      type: "currency",align: "right", sortable: true },
      { key: "1-30",       label: "1–30 days",    type: "currency",align: "right", sortable: true },
      { key: "31-60",      label: "31–60 days",   type: "currency",align: "right", sortable: true },
      { key: "61-90",      label: "61–90 days",   type: "currency",align: "right", sortable: true },
      { key: "90+",        label: "90+ days",     type: "currency",align: "right", sortable: true },
      { key: "total",      label: "Total",        type: "currency",align: "right", sortable: true },
    ],
    rows,
    totals,
    charts: [
      {
        type:  "bar",
        title: "AP Aging Buckets",
        data:  [
          { bucket: "Current",   amount: totals.current  },
          { bucket: "1–30 days", amount: totals["1-30"]  },
          { bucket: "31–60",     amount: totals["31-60"] },
          { bucket: "61–90",     amount: totals["61-90"] },
          { bucket: "90+",       amount: totals["90+"]   },
        ],
        xKey:  "bucket",
        yKeys: ["amount"],
      },
    ],
  };
}

function getApBucket(days: number): string {
  if (days < 1)   return "current";
  if (days < 31)  return "1-30";
  if (days < 61)  return "31-60";
  if (days < 91)  return "61-90";
  return "90+";
}
