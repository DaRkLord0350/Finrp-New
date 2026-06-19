// ============================================================
// /api/accounting/journals/:id
// GET    — full journal entry with lines
// PUT    — update a draft journal
// DELETE — soft-delete a draft journal
// ============================================================

import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { hasPermission } from "@/lib/auth/check-permission";
import { journalService } from "@/lib/services/journal.service";
import { mapAccountingError } from "@/lib/accounting/http";
import { UpdateJournalSchema } from "@/lib/validators/journal";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const { id } = await params;
    const journal = await journalService.getById(organizationId, id);
    return NextResponse.json(journal);
  } catch (err) {
    return mapAccountingError(err, "JOURNAL_GET");
  }
}

export async function PUT(req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.write");
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = UpdateJournalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    const canOverrideLock = await hasPermission("accounting.manage");
    const journal = await journalService.updateDraft(organizationId, { userId: user.id, canOverrideLock }, id, parsed.data);
    return NextResponse.json(journal);
  } catch (err) {
    return mapAccountingError(err, "JOURNAL_PUT");
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.delete");
    const { id } = await params;
    await journalService.deleteDraft(organizationId, { userId: user.id }, id);
    return NextResponse.json({ message: "Draft deleted" });
  } catch (err) {
    return mapAccountingError(err, "JOURNAL_DELETE");
  }
}
