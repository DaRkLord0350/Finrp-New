// GET /api/accounting/fiscal-years/:id — year + periods
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { fiscalYearService } from "@/lib/services/fiscal-year.service";
import { mapAccountingError } from "@/lib/accounting/http";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const { id } = await params;
    const fy = await fiscalYearService.getById(organizationId, id);
    return NextResponse.json(fy);
  } catch (err) {
    return mapAccountingError(err, "FISCAL_YEAR_GET");
  }
}
