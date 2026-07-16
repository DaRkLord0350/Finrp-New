// ============================================================
// /api/admin/credit/usage — platform-operator cross-tenant Credit
// Bureau usage view. Gated by userRole === "ADMIN", mirrors
// app/api/admin/kyc/route.ts's auth shape — NOT tenant-scoped.
// Fills the "Credit Bureau Usage" placeholder left in the admin
// Lending page when Module 1 shipped.
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user || user.userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [pullsByProvider, pullsByStatus, apiLogStats, last30DaysPulls] = await Promise.all([
      prisma.creditReport.groupBy({ by: ["provider"], _count: { _all: true } }),
      prisma.creditReport.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.creditApiLog.groupBy({ by: ["provider", "success"], _count: { _all: true }, _avg: { durationMs: true } }),
      prisma.creditReport.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
    ]);

    return NextResponse.json({
      pullsByProvider: pullsByProvider.map((p) => ({ provider: p.provider, count: p._count._all })),
      pullsByStatus: pullsByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      apiLogStats: apiLogStats.map((s) => ({
        provider: s.provider,
        success: s.success,
        count: s._count._all,
        avgDurationMs: Math.round(s._avg.durationMs ?? 0),
      })),
      last30DaysPulls,
    });
  } catch (err) {
    console.error("[ADMIN_CREDIT_USAGE_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
