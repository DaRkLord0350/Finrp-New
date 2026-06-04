// ============================================================
// GET /api/erp — Full ERP Dashboard Data
// Returns computed metrics, alerts, suggestions, projects
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { erpService } from "@/services/erpService";
import { getTenantId } from "@/lib/auth/tenant";
import { withCache, TTL } from "@/lib/cache";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await withCache(
      `finrp:erp:dashboard:${tenantId}`,
      TTL.ANALYTICS,
      () => erpService.getDashboard(tenantId)
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/erp]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}