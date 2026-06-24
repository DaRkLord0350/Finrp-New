// ============================================================
// POST /api/portal/filings/[id]/comments
//   Either party adds a comment to a filing approval.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireFirmSide, requireCustomer } from "@/lib/client-portal/auth";
import { addFilingComment } from "@/lib/client-portal/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const text = String(body?.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "body is required" }, { status: 400 });

  // Either a firm-side user or the owning customer may comment.
  const firm = await requireFirmSide();
  if (firm) {
    const result = await addFilingComment(
      { organizationId: firm.organizationId, userId: firm.id, authorName: firm.name ?? firm.email },
      id,
      text
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ comment: result.data }, { status: 201 });
  }

  const customer = await requireCustomer();
  if (customer) {
    const result = await addFilingComment(
      {
        organizationId: customer.ctx.organizationId,
        userId: customer.actor.id,
        authorName: customer.actor.name ?? customer.actor.email,
      },
      id,
      text
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ comment: result.data }, { status: 201 });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
