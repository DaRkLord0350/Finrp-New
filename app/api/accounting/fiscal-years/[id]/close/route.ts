// GET  /api/accounting/fiscal-years/:id/close — preview closing entry
// POST /api/accounting/fiscal-years/:id/close — post closing journal + lock periods
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { fiscalYearService } from "@/lib/services/fiscal-year.service";
import { mapAccountingError } from "@/lib/accounting/http";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { organizationId } = await requirePermission("accounting.manage");
    const { id } = await params;
    const preview = await fiscalYearService.previewClose(organizationId, id);
    return NextResponse.json({
      lineCount: preview.lineCount,
      netIncome: Number(preview.netIncome),
      fiscalYear: { name: preview.fiscalYear.name, endDate: preview.fiscalYear.endDate },
    });
  } catch (err) {
    return mapAccountingError(err, "FISCAL_YEAR_CLOSE_PREVIEW");
  }
}

export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.manage");
    const { id } = await params;
    const fy = await fiscalYearService.close(organizationId, { userId: user.id }, id);
    return NextResponse.json(fy);
  } catch (err) {
    return mapAccountingError(err, "FISCAL_YEAR_CLOSE");
  }
}
