import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapFraudError } from "@/lib/fraud/http";
import { getCaseDetail, assignCase, escalateCase, resolveCase } from "@/lib/fraud/case-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "fraud.read" });
    const { id } = await params;
    const fraudCase = await getCaseDetail(id, organizationId);
    return NextResponse.json({ case: fraudCase });
  } catch (err) {
    return mapFraudError(err, "FRAUD_CASE_GET");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "fraud.review" });
    const { id } = await params;
    const body = await req.json();

    let fraudCase;
    if (body.action === "assign") {
      if (!body.assignedToId) return NextResponse.json({ error: "assignedToId is required" }, { status: 400 });
      fraudCase = await assignCase(id, organizationId, body.assignedToId, { userId });
    } else if (body.action === "escalate") {
      fraudCase = await escalateCase(id, organizationId, body.notes, { userId });
    } else if (body.action === "resolve") {
      const check = await requireTenant({ permission: "fraud.approve" });
      fraudCase = await resolveCase(id, organizationId, body, { userId: check.userId, role, canApprove: true });
    } else {
      return NextResponse.json({ error: "action must be 'assign', 'escalate', or 'resolve'" }, { status: 400 });
    }
    return NextResponse.json({ case: fraudCase });
  } catch (err) {
    return mapFraudError(err, "FRAUD_CASE_PATCH");
  }
}
