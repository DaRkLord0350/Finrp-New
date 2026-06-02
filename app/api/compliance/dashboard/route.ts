import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { complianceDashboardService } from "@/services/compliance/complianceDashboardService";
import { withCache, cacheDel, CacheKey, TTL } from "@/lib/cache";

export async function GET() {
  try {
    const { organizationId } = await requirePermission("compliance.read");
    const cacheKey = `finrp:compliance:dashboard:${organizationId}`;
    const data = await withCache(
      cacheKey,
      TTL.ANALYTICS,
      () => complianceDashboardService.getDashboard(organizationId)
    );
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_DASHBOARD_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function invalidateComplianceDashboardCache(orgId: string) {
  await cacheDel(`finrp:compliance:dashboard:${orgId}`);
}
