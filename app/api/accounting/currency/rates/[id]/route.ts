// DELETE /api/accounting/currency/rates/:id
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { currencyService } from "@/lib/services/currency.service";
import { mapAccountingError } from "@/lib/accounting/http";

type RouteCtx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.write");
    const { id } = await params;
    await currencyService.deleteRate(organizationId, { userId: user.id }, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapAccountingError(err, "CURRENCY_RATE_DELETE");
  }
}
