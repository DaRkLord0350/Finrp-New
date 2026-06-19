// ============================================================
// GET /api/accounting/dashboard
// Real-data KPI summary for the Accounting overview.
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { accountingService } from "@/lib/services/accounting.service";

export const GET = withAuth(async (_req, { organizationId }) => {
  const summary = await accountingService.getDashboardSummary(organizationId);
  return NextResponse.json(summary);
}, "accounting.read");
