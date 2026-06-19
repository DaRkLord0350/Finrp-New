// GET  /api/accounting/budgets — list
// POST /api/accounting/budgets — create
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { budgetService } from "@/lib/services/budget.service";
import { mapAccountingError } from "@/lib/accounting/http";
import { CreateBudgetSchema } from "@/lib/validators/budget";

export async function GET() {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const budgets = await budgetService.list(organizationId);
    return NextResponse.json({ budgets });
  } catch (err) {
    return mapAccountingError(err, "BUDGETS_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("accounting.write");
    const body = await req.json().catch(() => null);
    const parsed = CreateBudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    const budget = await budgetService.create(organizationId, { userId: user.id }, parsed.data);
    return NextResponse.json(budget, { status: 201 });
  } catch (err) {
    return mapAccountingError(err, "BUDGETS_POST");
  }
}
