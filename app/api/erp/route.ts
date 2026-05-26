// ============================================================
// GET /api/erp — Full ERP Dashboard Data
// Returns computed metrics, alerts, suggestions, projects
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { erpService } from "@/services/erpService";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    const data = await erpService.getDashboard(organizationId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/erp]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}, "erp.read");