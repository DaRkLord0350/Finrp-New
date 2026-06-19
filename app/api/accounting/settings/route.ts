// GET /api/accounting/settings — accounting settings (lock date + mappings)
// PUT /api/accounting/settings — update (lock date, account mappings)
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { accountingSettingsService } from "@/lib/services/accounting-settings.service";
import { mapAccountingError } from "@/lib/accounting/http";
import { UpdateAccountingSettingsSchema } from "@/lib/validators/fiscal-year";

export async function GET() {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const settings = await accountingSettingsService.get(organizationId);
    return NextResponse.json(settings);
  } catch (err) {
    return mapAccountingError(err, "ACCOUNTING_SETTINGS_GET");
  }
}

export async function PUT(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("accounting.manage");
    const body = await req.json().catch(() => null);
    const parsed = UpdateAccountingSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    const settings = await accountingSettingsService.update(organizationId, { userId: user.id }, parsed.data);
    return NextResponse.json(settings);
  } catch (err) {
    return mapAccountingError(err, "ACCOUNTING_SETTINGS_PUT");
  }
}
