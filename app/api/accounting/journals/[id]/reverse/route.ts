// POST /api/accounting/journals/:id/reverse — create a reversing entry
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { hasPermission } from "@/lib/auth/check-permission";
import { journalService } from "@/lib/services/journal.service";
import { mapAccountingError } from "@/lib/accounting/http";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.write");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reversalDate = body?.reversalDate ? new Date(body.reversalDate) : undefined;
    const canOverrideLock = await hasPermission("accounting.manage");
    const journal = await journalService.reverse(organizationId, { userId: user.id, canOverrideLock }, id, reversalDate);
    return NextResponse.json(journal, { status: 201 });
  } catch (err) {
    return mapAccountingError(err, "JOURNAL_REVERSE");
  }
}
