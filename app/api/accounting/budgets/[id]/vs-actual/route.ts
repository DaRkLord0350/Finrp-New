// GET /api/accounting/budgets/:id/vs-actual — budget vs actual variance
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { budgetService } from "@/lib/services/budget.service";
import { mapAccountingError } from "@/lib/accounting/http";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const { id } = await params;
    const result = await budgetService.vsActual(organizationId, id);
    return NextResponse.json(result);
  } catch (err) {
    return mapAccountingError(err, "BUDGET_VS_ACTUAL");
  }
}
