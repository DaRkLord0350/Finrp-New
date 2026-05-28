import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { complianceDashboardService } from "@/services/compliance/complianceDashboardService";

export async function GET() {
  try {
    const { organizationId } = await requirePermission("compliance.read");
    const data = await complianceDashboardService.getDashboard(organizationId);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_DASHBOARD_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
