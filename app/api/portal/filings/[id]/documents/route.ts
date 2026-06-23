// ============================================================
// POST /api/portal/filings/[id]/documents
//   CA attaches GST/ITR documents to a filing approval.
//   body.documents: [{ fileName, fileUrl, mimeType?, fileSize? }]
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireFirmSide } from "@/lib/client-portal/auth";
import { addFilingDocuments } from "@/lib/client-portal/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireFirmSide();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const documents = Array.isArray(body?.documents) ? body.documents : null;
  if (!documents) return NextResponse.json({ error: "documents array is required" }, { status: 400 });

  const result = await addFilingDocuments(actor, id, documents);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ added: result.data.count }, { status: 201 });
}
