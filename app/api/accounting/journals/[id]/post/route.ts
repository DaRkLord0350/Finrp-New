// POST /api/accounting/journals/:id/post — post a draft journal to the ledger
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { hasPermission } from "@/lib/auth/check-permission";
import { journalService } from "@/lib/services/journal.service";
import { mapAccountingError } from "@/lib/accounting/http";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.write");
    const { id } = await params;
    const canOverrideLock = await hasPermission("accounting.manage");
    const journal = await journalService.post(organizationId, { userId: user.id, canOverrideLock }, id);
    return NextResponse.json(journal);
  } catch (err) {
    return mapAccountingError(err, "JOURNAL_POST_ACTION");
  }
}
