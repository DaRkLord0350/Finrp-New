// ============================================================
// POST /api/portal/filings/[id]/decision
//   Customer approves or rejects a filing.
//   body: { approve: boolean, comment?: string }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/client-portal/auth";
import { decideFiling } from "@/lib/client-portal/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await requireCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.approve !== "boolean") {
    return NextResponse.json({ error: "approve (boolean) is required" }, { status: 400 });
  }

  const result = await decideFiling(customer.actor, customer.ctx.organizationId, id, {
    approve: body.approve,
    comment: body.comment ?? null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ filing: result.data });
}
