// ============================================================
// lib/credit/comparison.ts
// Comparison history / credit trend across a subject's past pulls.
// CreditReport rows are immutable per-pull (see schema comment), so
// this is purely a read + pure-function computation, no new state.
// ============================================================

import { prisma } from "@/lib/prisma";
import { computeCreditTrend, type CreditTrendResult } from "./core/risk-categorization";

export interface CreditHistoryEntry {
  reportId: string;
  provider: string;
  pullType: string;
  pulledAt: Date | null;
  score: number | null;
  riskGrade: string | null;
}

export async function getCreditHistory(
  organizationId: string,
  subjectType: string,
  subjectId: string
): Promise<{ history: CreditHistoryEntry[]; trend: CreditTrendResult }> {
  const reports = await prisma.creditReport.findMany({
    where: { organizationId, subjectType: subjectType as never, subjectId, status: "COMPLETED" },
    include: { scores: true },
    orderBy: { pulledAt: "asc" },
  });

  const history: CreditHistoryEntry[] = reports.map((r) => ({
    reportId: r.id,
    provider: r.provider,
    pullType: r.pullType,
    pulledAt: r.pulledAt,
    score: r.scores[0]?.score ?? null,
    riskGrade: r.scores[0]?.riskGrade ?? null,
  }));

  const trend = computeCreditTrend(
    history.filter((h): h is CreditHistoryEntry & { pulledAt: Date; score: number } => h.pulledAt !== null && h.score !== null)
      .map((h) => ({ pulledAt: h.pulledAt, score: h.score }))
  );

  return { history, trend };
}
