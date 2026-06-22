// ============================================================
// /api/tax/filing/[id]/reject
// POST — reject a PENDING_APPROVAL filing with a reason.
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { reject } from "@/lib/tax/filing/service";
import { mapTaxError } from "@/lib/tax/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId, role } = await requireTenant({ permission: "tax.approve" });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason : "Rejected during review";
    const submission = await reject({
      submissionId: id,
      organizationId,
      reason,
      actor: { userId, role, canApprove: true },
    });
    return NextResponse.json({ submission });
  } catch (err) {
    return mapTaxError(err, "FILING_REJECT");
  }
}
