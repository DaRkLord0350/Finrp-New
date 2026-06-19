// ============================================================
// /api/accounting/journals
// GET  — paginated/filtered list of journal entries
// POST — create a journal (draft, or posted when { post: true })
// ============================================================

import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { hasPermission } from "@/lib/auth/check-permission";
import { journalService } from "@/lib/services/journal.service";
import { mapAccountingError } from "@/lib/accounting/http";
import { CreateJournalSchema, ListJournalsQuerySchema } from "@/lib/validators/journal";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const url = new URL(req.url);
    const parsed = ListJournalsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", issues: parsed.error.flatten() }, { status: 400 });
    }
    const result = await journalService.list(organizationId, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return mapAccountingError(err, "JOURNALS_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("accounting.write");
    const body = await req.json().catch(() => null);
    const parsed = CreateJournalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }
    const canOverrideLock = await hasPermission("accounting.manage");
    const journal = await journalService.create(organizationId, { userId: user.id, canOverrideLock }, parsed.data);
    return NextResponse.json(journal, { status: 201 });
  } catch (err) {
    return mapAccountingError(err, "JOURNALS_POST");
  }
}
