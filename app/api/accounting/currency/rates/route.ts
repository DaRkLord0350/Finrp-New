// GET  /api/accounting/currency/rates — list rate book
// POST /api/accounting/currency/rates — upsert a rate
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { currencyService } from "@/lib/services/currency.service";
import { mapAccountingError } from "@/lib/accounting/http";
import { UpsertRateSchema } from "@/lib/validators/currency";

export async function GET() {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const rates = await currencyService.listRates(organizationId);
    return NextResponse.json({ rates });
  } catch (err) {
    return mapAccountingError(err, "CURRENCY_RATES_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("accounting.write");
    const body = await req.json().catch(() => null);
    const parsed = UpsertRateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    const rate = await currencyService.upsertRate(organizationId, { userId: user.id }, parsed.data);
    return NextResponse.json(rate, { status: 201 });
  } catch (err) {
    return mapAccountingError(err, "CURRENCY_RATES_POST");
  }
}
