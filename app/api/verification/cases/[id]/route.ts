import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapVerificationError } from "@/lib/verification/http";
import { getCaseDetail, assignCase, holdCase, completeCase } from "@/lib/verification/case-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "verification.read" });
    const { id } = await params;
    const kase = await getCaseDetail(id, organizationId);
    return NextResponse.json({ case: kase });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_CASE_GET");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "verification.initiate" });
    const { id } = await params;
    const body = await req.json();

    let kase;
    if (body.action === "assign") {
      if (!body.assignedToId) return NextResponse.json({ error: "assignedToId is required" }, { status: 400 });
      kase = await assignCase(id, organizationId, body.assignedToId, { userId });
    } else if (body.action === "hold") {
      kase = await holdCase(id, organizationId, body.notes, { userId });
    } else if (body.action === "complete") {
      // Completing/rejecting a case requires the stricter verification.review
      // permission — re-check here since this route is gated at
      // verification.initiate for assign/hold.
      const check = await requireTenant({ permission: "verification.review" });
      if (body.outcome !== "COMPLETED" && body.outcome !== "REJECTED") {
        return NextResponse.json({ error: "outcome must be 'COMPLETED' or 'REJECTED'" }, { status: 400 });
      }
      kase = await completeCase(id, organizationId, { outcome: body.outcome, notes: body.notes }, { userId: check.userId, role, canReview: true });
    } else {
      return NextResponse.json({ error: "action must be 'assign', 'hold', or 'complete'" }, { status: 400 });
    }
    return NextResponse.json({ case: kase });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_CASE_PATCH");
  }
}
