// ============================================================
// GET /api/erp — Full ERP Dashboard Data
// Returns computed metrics, alerts, suggestions, projects
// ============================================================

import { NextResponse } from "next/server";
import { erpService } from "@/services/erpService";
import { requirePermission } from "@/lib/auth/middleware";
import { withCache, TTL } from "@/lib/cache";

export async function GET() {
  try {
    // RBAC: ERP module is restricted (e.g. ACCOUNTANT / VIEWER get 403).
    const { organizationId } = await requirePermission("erp.read");

    const data = await withCache(
      `finrp:erp:dashboard:${organizationId}`,
      TTL.ANALYTICS,
      () => erpService.getDashboard(organizationId)
    );

    return NextResponse.json(data);
  } catch (error) {
    // requirePermission throws a NextResponse (401/403) — pass it through.
    if (error instanceof NextResponse) return error;
    console.error("[GET /api/erp]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}