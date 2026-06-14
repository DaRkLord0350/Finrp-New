// ============================================================
// GET /api/ca-hub/dashboard
//
// Reference implementation of the CA Hub API pattern:
//   • withTenant() — Clerk auth + tenant resolution (mirrors every
//     other FinRP API route).
//   • Firm-scoped aggregates over the ca_hub_* models in a single
//     $transaction (SQL COUNTs, not in-memory filtering).
//   • Graceful fallback: until `prisma migrate` creates the ca_hub_*
//     tables, the query throws → we return representative data so the
//     dashboard stays fully functional. Swap the front-end fetch to
//     this endpoint once migrated.
//
// This same shape (resolve firmId → aggregate → JSON) is how the other
// 13 modules' endpoints should be built. See CA_HUB_ARCHITECTURE.md.
// ============================================================

import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { practiceKpis } from "@/lib/ca-hub/demo-data";

const OPEN_FILING = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "PENDING_DOCS",
  "PENDING_REVIEW",
  "READY_TO_FILE",
  "OVERDUE",
] as const;

export const GET = withTenant(async (_req, { userId }) => {
  // Resolve the firm this CA/staff user belongs to (practice tenant scope).
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { firmId: true },
  });
  const firmId = user?.firmId ?? undefined;

  try {
    const [gstDue, tdsDue, itrDue, rocDue, auditPending, totalClients, overdue] =
      await prisma.$transaction([
        prisma.gstFiling.count({ where: { firmId, status: { in: OPEN_FILING as unknown as never } } }),
        prisma.tdsReturn.count({ where: { firmId, status: { in: OPEN_FILING as unknown as never } } }),
        prisma.itrFiling.count({ where: { firmId, status: { in: OPEN_FILING as unknown as never } } }),
        prisma.rocFiling.count({ where: { firmId, status: { in: OPEN_FILING as unknown as never } } }),
        prisma.auditEngagement.count({ where: { firmId, status: { not: "SIGNED_OFF" } } }),
        prisma.clientComplianceProfile.count({ where: { firmId } }),
        prisma.gstFiling.count({ where: { firmId, status: "OVERDUE" } }),
      ]);

    return NextResponse.json({
      source: "live",
      kpis: { totalClients, gstDue, tdsDue, itrDue, rocDue, auditPending, overdue },
    });
  } catch {
    // ca_hub_* tables not migrated yet → representative data keeps the UI alive.
    return NextResponse.json({ source: "demo", kpis: practiceKpis });
  }
});
