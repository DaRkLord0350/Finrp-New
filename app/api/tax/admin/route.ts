// ============================================================
// /api/tax/admin
// GET — admin dashboard payload: filing status, provider/API health,
//       queued/failed jobs, failed validations, reconciliation
//       summaries, and recent tax audit logs.
// ============================================================

import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { getDlqHealth } from "@/lib/jobs/queues/dlq";
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
      // Tax job stats now come from the TaxJobRun ledger (Inngest-backed).
      prisma.taxJobRun
        .groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } })
        .catch(() => null),
      getDlqHealth().catch(() => null),
    ]);

  const filingStatus: Record<string, number> = {};
  for (const g of statusGroups) filingStatus[g.status] = g._count._all;

  const taxCounts = queueCounts
    ? (() => {
        const by = Object.fromEntries(queueCounts.map((g) => [g.status, g._count._all]));
        return {
          waiting: by.QUEUED ?? 0,
          active: by.RUNNING ?? 0,
          completed: by.COMPLETED ?? 0,
          failed: by.FAILED ?? 0,
        };
      })()
    : null;

  return NextResponse.json({
    provider: { name: provider.name, isLive: provider.isLive, health: providerHealth },
    queue: { tax: taxCounts, dlq: dlqCounts },
    filingStatus,
    recentJobs,
    failedValidations,
    reconciliations: recentRecons,
    auditLogs,
  });
}, { permission: "tax.read" });
