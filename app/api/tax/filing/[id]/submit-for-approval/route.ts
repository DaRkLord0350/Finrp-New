// ============================================================
// /api/tax/filing/[id]/submit-for-approval
// POST — move a READY filing into PENDING_APPROVAL
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { submitForApproval } from "@/lib/tax/filing/service";
import { mapTaxError } from "@/lib/tax/http";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId, role } = await requireTenant({ permission: "tax.write" });
    const { id } = await params;
    const submission = await submitForApproval({
      submissionId: id,
      organizationId,
      actor: { userId, role },
    });
    return NextResponse.json({ submission });
  } catch (err) {
    return mapTaxError(err, "FILING_SUBMIT_APPROVAL");
  }
}
