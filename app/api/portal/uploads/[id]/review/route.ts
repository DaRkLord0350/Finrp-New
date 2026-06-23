// ============================================================
// POST /api/portal/uploads/[id]/review
//   CA reviews an uploaded document.
//   body.status: UNDER_REVIEW | APPROVED | REJECTED
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireFirmSide } from "@/lib/client-portal/auth";
import { reviewUpload } from "@/lib/client-portal/service";
import type { DocumentUploadStatus } from "@prisma/client";

const VALID: DocumentUploadStatus[] = ["UNDER_REVIEW", "APPROVED", "REJECTED"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireFirmSide();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = body?.status as DocumentUploadStatus;
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "status must be UNDER_REVIEW, APPROVED or REJECTED" }, { status: 400 });
  }

  const result = await reviewUpload(actor, id, { status, reviewNotes: body.reviewNotes ?? null });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ upload: result.data });
}
