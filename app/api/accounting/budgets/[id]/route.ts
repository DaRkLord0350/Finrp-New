// GET    /api/accounting/budgets/:id — budget + lines
// PUT    /api/accounting/budgets/:id — update name/status OR set lines
// DELETE /api/accounting/budgets/:id — remove
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { budgetService } from "@/lib/services/budget.service";
import { mapAccountingError } from "@/lib/accounting/http";
import { UpdateBudgetSchema, SetBudgetLinesSchema } from "@/lib/validators/budget";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const { id } = await params;
    const budget = await budgetService.getById(organizationId, id);
    return NextResponse.json(budget);
  } catch (err) {
    return mapAccountingError(err, "BUDGET_GET");
  }
}

export async function PUT(req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.write");
    const { id } = await params;
    const body = await req.json().catch(() => null);

    if (body && Array.isArray(body.lines)) {
      const parsed = SetBudgetLinesSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
      const budget = await budgetService.setLines(organizationId, { userId: user.id }, id, parsed.data.lines);
      return NextResponse.json(budget);
    }

    const parsed = UpdateBudgetSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    const budget = await budgetService.update(organizationId, { userId: user.id }, id, parsed.data);
    return NextResponse.json(budget);
  } catch (err) {
    return mapAccountingError(err, "BUDGET_PUT");
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.delete");
    const { id } = await params;
    await budgetService.remove(organizationId, { userId: user.id }, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapAccountingError(err, "BUDGET_DELETE");
  }
}
