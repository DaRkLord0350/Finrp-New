// PATCH /api/accounting/periods/:id — set period status (open/close/lock)
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { fiscalYearService } from "@/lib/services/fiscal-year.service";
import { mapAccountingError } from "@/lib/accounting/http";
import { SetPeriodStatusSchema } from "@/lib/validators/fiscal-year";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.manage");
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = SetPeriodStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    const period = await fiscalYearService.setPeriodStatus(organizationId, { userId: user.id }, id, parsed.data.status);
    return NextResponse.json(period);
  } catch (err) {
    return mapAccountingError(err, "PERIOD_PATCH");
  }
}
