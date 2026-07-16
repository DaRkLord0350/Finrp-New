import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { decideApprovalStep } from "@/lib/lending/workflow/service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.approve" });
    const { id, stepId } = await params;
    const { decision, comments } = await req.json();
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return NextResponse.json({ error: "decision must be 'APPROVED' or 'REJECTED'" }, { status: 400 });
    }
    const application = await decideApprovalStep({
      applicationId: id,
      organizationId,
      stepId,
      decision,
      comments,
      actor: { userId, role, canApprove: true },
    });
    return NextResponse.json({ application });
  } catch (err) {
    return mapLendingError(err, "LENDING_APPROVAL_STEP_PATCH");
  }
}
