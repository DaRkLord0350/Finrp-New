// GET  /api/accounting/currency/revaluations — list runs (and ?preview=<date>)
// POST /api/accounting/currency/revaluations — post a revaluation
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { currencyService } from "@/lib/services/currency.service";
import { mapAccountingError } from "@/lib/accounting/http";
import { RevaluationSchema } from "@/lib/validators/currency";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const url = new URL(req.url);
    const preview = url.searchParams.get("preview");
    if (preview) {
      const result = await currencyService.compute(organizationId, new Date(preview));
      return NextResponse.json({ preview: result });
    }
    const revaluations = await currencyService.listRevaluations(organizationId);
    return NextResponse.json({ revaluations });
  } catch (err) {
    return mapAccountingError(err, "CURRENCY_REVAL_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("accounting.manage");
    const body = await req.json().catch(() => null);
    const parsed = RevaluationSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    const result = await currencyService.post(organizationId, { userId: user.id }, parsed.data.asOfDate);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return mapAccountingError(err, "CURRENCY_REVAL_POST");
  }
}
