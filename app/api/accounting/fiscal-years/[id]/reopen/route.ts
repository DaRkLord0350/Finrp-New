// POST /api/accounting/fiscal-years/:id/reopen — reopen a closed year
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { fiscalYearService } from "@/lib/services/fiscal-year.service";
import { mapAccountingError } from "@/lib/accounting/http";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.manage");
    const { id } = await params;
    const fy = await fiscalYearService.reopen(organizationId, { userId: user.id }, id);
    return NextResponse.json(fy);
  } catch (err) {
    return mapAccountingError(err, "FISCAL_YEAR_REOPEN");
  }
}
