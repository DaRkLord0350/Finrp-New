// ============================================================
// /api/tax/filing/[id]/approve
// POST — CA approval checkpoint: PENDING_APPROVAL → APPROVED.
// Requires the tax.approve permission (enforced twice: route + service).
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { approve } from "@/lib/tax/filing/service";
import { mapTaxError } from "@/lib/tax/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId, role } = await requireTenant({ permission: "tax.approve" });
    const { id } = await params;
    const submission = await approve({
      submissionId: id,
      organizationId,
      actor: { userId, role, canApprove: true },
    });
    return NextResponse.json({ submission });
  } catch (err) {
    return mapTaxError(err, "FILING_APPROVE");
  }
}
