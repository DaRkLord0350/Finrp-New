// ============================================================
// /api/tax/admin
// GET — admin dashboard payload: filing status, provider/API health,
//       queued/failed jobs, failed validations, reconciliation
//       summaries, and recent tax audit logs.
// ============================================================

import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { getTaxQueue } from "@/lib/tax/queue";
import { getDlq } from "@/lib/jobs/queues/dlq";
import { getFilingProvider } from "@/lib/tax/filing/factory";

export const GET = withTenant(async (_req, { organizationId }) => {
  const provider = getFilingProvider();

  const [statusGroups, recentJobs, failedValidations, recentRecons, auditLogs, providerHealth, queueCounts, dlqCounts] =
    await Promise.all([
      prisma.taxFilingSubmission.groupBy({
        by: ["status"],
        where: { organizationId, deletedAt: null },
        _count: { _all: true },
      }),
      prisma.taxJobRun.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.taxValidationRun.findMany({
        where: { organizationId, passed: false },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.gstReconciliation.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.auditLog.findMany({
        where: { organizationId, entity: { startsWith: "tax" } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      provider.healthCheck().catch((e) => ({ ok: false, detail: (e as Error).message })),
      getTaxQueue().getJobCounts("waiting", "active", "completed", "failed").catch(() => null),
      getDlq().getJobCounts("waiting", "failed").catch(() => null),
    ]);

  const filingStatus: Record<string, number> = {};
  for (const g of statusGroups) filingStatus[g.status] = g._count._all;

  return NextResponse.json({
    provider: { name: provider.name, isLive: provider.isLive, health: providerHealth },
    queue: { tax: queueCounts, dlq: dlqCounts },
    filingStatus,
    recentJobs,
    failedValidations,
    reconciliations: recentRecons,
    auditLogs,
  });
}, { permission: "tax.read" });
