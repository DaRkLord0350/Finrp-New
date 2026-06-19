// GET  /api/accounting/bulk-account-update — list jobs (or ?id= for one)
// POST /api/accounting/bulk-account-update — enqueue a replace-account job
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { bulkAccountUpdateService } from "@/lib/services/bulk-account-update.service";
import { mapAccountingError } from "@/lib/accounting/http";
import { CreateBulkUpdateSchema } from "@/lib/validators/bulk-account-update";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      const job = await bulkAccountUpdateService.get(organizationId, id);
      return NextResponse.json(job);
    }
    const jobs = await bulkAccountUpdateService.list(organizationId);
    return NextResponse.json({ jobs });
  } catch (err) {
    return mapAccountingError(err, "BULK_UPDATE_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("accounting.manage");
    const body = await req.json().catch(() => null);
    const parsed = CreateBulkUpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    const result = await bulkAccountUpdateService.create(organizationId, { userId: user.id }, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return mapAccountingError(err, "BULK_UPDATE_POST");
  }
}
