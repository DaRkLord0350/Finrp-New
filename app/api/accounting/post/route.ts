// GET    /api/accounting/post — unposted documents
// POST   /api/accounting/post — post a document to the ledger { source, sourceId }
// DELETE /api/accounting/post — unpost a document { source, sourceId }
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/middleware";
import { hasPermission } from "@/lib/auth/check-permission";
import { postDocument, unpostSource, listUnpostedDocuments, type PostingSource } from "@/lib/accounting/posting";
import { mapAccountingError } from "@/lib/accounting/http";

const PostSchema = z.object({
  source: z.enum(["INVOICE", "PAYMENT", "EXPENSE", "PURCHASE", "INVENTORY"]),
  sourceId: z.string().min(1),
});

export async function GET() {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const docs = await listUnpostedDocuments(organizationId);
    return NextResponse.json(docs);
  } catch (err) {
    return mapAccountingError(err, "POST_LIST");
  }
}

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("accounting.post");
    const body = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    const canOverride = await hasPermission("accounting.manage");
    const result = await postDocument(organizationId, parsed.data.source as PostingSource, parsed.data.sourceId, { userId: user.id }, canOverride);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return mapAccountingError(err, "POST_DOC");
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("accounting.post");
    const body = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    await unpostSource(organizationId, parsed.data.source as PostingSource, parsed.data.sourceId, { userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapAccountingError(err, "UNPOST_DOC");
  }
}
