// ============================================================
// Report Service — routes slug → generator, handles caching
// ============================================================

import { prisma } from "@/lib/prisma";
import { hashFilters } from "./filters";
import type { ReportFilters, ReportResult } from "./types";
import { getReport } from "./registry";
import { generateProfitLoss }       from "./profit-loss";
import { generateCashFlow }         from "./cash-flow";
import { generateSalesSummary }     from "./sales-summary";
import { generateSalesByCustomer }  from "./sales-by-customer";
import { generateSalesByItem }      from "./sales-by-item";
import { generateArAging }          from "./ar-aging";
import { generateCustomerBalance }  from "./customer-balance";
import { generateReceivableSummary } from "./receivable-summary";
import { generateApAging }          from "./ap-aging";
import { generateVendorBalance }    from "./vendor-balance";
import { generateTrialBalance }     from "./trial-balance";
import { generateGeneralLedger }    from "./general-ledger";
import { generateBalanceSheet }     from "./balance-sheet";
import { generateActivityLogs }     from "./activity-logs";

const REPORT_TTL_SECONDS = 300; // 5-minute cache TTL

type Generator = (
  organizationId: string,
  filters: ReportFilters
) => Promise<ReportResult>;

const GENERATORS: Record<string, Generator> = {
  "profit-loss":      generateProfitLoss,
  "cash-flow":        generateCashFlow,
  "sales-summary":    generateSalesSummary,
  "sales-by-customer": generateSalesByCustomer,
  "sales-by-item":    generateSalesByItem,
  "ar-aging":         generateArAging,
  "customer-balance": generateCustomerBalance,
  "receivable-summary": generateReceivableSummary,
  "ap-aging":         generateApAging,
  "vendor-balance":   generateVendorBalance,
  "trial-balance":    generateTrialBalance,
  "general-ledger":   generateGeneralLedger,
  "balance-sheet":    generateBalanceSheet,
  "activity-logs":    generateActivityLogs,
};

export async function runReport(
  slug: string,
  organizationId: string,
  filters: ReportFilters,
  useCache = true
): Promise<ReportResult> {
  const definition = getReport(slug);
  if (!definition) throw new Error(`Unknown report: ${slug}`);

  const generator = GENERATORS[slug];
  if (!generator) throw new Error(`No generator for report: ${slug}`);

  if (useCache) {
    const filterHash = hashFilters(filters);
    const cached = await prisma.reportCache.findUnique({
      where: {
        organizationId_reportSlug_filterHash: {
          organizationId,
          reportSlug: slug,
          filterHash,
        },
      },
    });

    if (cached && cached.expiresAt > new Date()) {
      return cached.payload as unknown as ReportResult;
    }
  }

  const result = await generator(organizationId, filters);

  // Write cache entry (fire-and-forget)
  const filterHash = hashFilters(filters);
  const expiresAt  = new Date(Date.now() + REPORT_TTL_SECONDS * 1000);
  prisma.reportCache
    .upsert({
      where: {
        organizationId_reportSlug_filterHash: {
          organizationId,
          reportSlug: slug,
          filterHash,
        },
      },
      create: { organizationId, reportSlug: slug, filterHash, payload: result as object, expiresAt },
      update: { payload: result as object, generatedAt: new Date(), expiresAt },
    })
    .catch(() => {});

  return result;
}

export async function isFavorite(
  userId: string,
  organizationId: string,
  reportSlug: string
): Promise<boolean> {
  const fav = await prisma.favoriteReport.findUnique({
    where: {
      userId_organizationId_reportSlug: { userId, organizationId, reportSlug },
    },
  });
  return fav !== null;
}

export async function toggleFavorite(
  userId: string,
  organizationId: string,
  reportSlug: string
): Promise<{ favorited: boolean }> {
  const existing = await prisma.favoriteReport.findUnique({
    where: {
      userId_organizationId_reportSlug: { userId, organizationId, reportSlug },
    },
  });

  if (existing) {
    await prisma.favoriteReport.delete({
      where: { id: existing.id },
    });
    return { favorited: false };
  }

  await prisma.favoriteReport.create({
    data: { userId, organizationId, reportSlug },
  });
  return { favorited: true };
}

export async function getFavorites(
  userId: string,
  organizationId: string
): Promise<string[]> {
  const favs = await prisma.favoriteReport.findMany({
    where: { userId, organizationId },
    select: { reportSlug: true },
  });
  return favs.map((f) => f.reportSlug);
}
