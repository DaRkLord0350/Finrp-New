// GET  /api/accounting/fiscal-years — list
// POST /api/accounting/fiscal-years — create year + monthly periods
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { fiscalYearService } from "@/lib/services/fiscal-year.service";
import { mapAccountingError } from "@/lib/accounting/http";
import { CreateFiscalYearSchema } from "@/lib/validators/fiscal-year";

export async function GET() {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const years = await fiscalYearService.list(organizationId);
    return NextResponse.json({ years });
  } catch (err) {
    return mapAccountingError(err, "FISCAL_YEARS_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("accounting.manage");
    const body = await req.json().catch(() => null);
    const parsed = CreateFiscalYearSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    const fy = await fiscalYearService.create(organizationId, { userId: user.id }, parsed.data);
    return NextResponse.json(fy, { status: 201 });
  } catch (err) {
    return mapAccountingError(err, "FISCAL_YEARS_POST");
  }
}
