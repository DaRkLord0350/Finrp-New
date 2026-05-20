// ============================================================
// GET /api/erp — Full ERP Dashboard Data
// Returns computed metrics, alerts, suggestions, projects
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { erpService } from "@/services/erpService";

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = orgId ?? userId;
    const data = await erpService.getDashboard(tenantId);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/erp]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}