import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapAmlError } from "@/lib/aml/http";
import { getCaseDetail, assignCase, escalateCase, resolveCase } from "@/lib/aml/case-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "aml.read" });
    const { id } = await params;
    const amlCase = await getCaseDetail(id, organizationId);
    return NextResponse.json({ case: amlCase });
  } catch (err) {
    return mapAmlError(err, "AML_CASE_GET");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "aml.review" });
    const { id } = await params;
    const body = await req.json();

    let amlCase;
    if (body.action === "assign") {
      if (!body.assignedToId) return NextResponse.json({ error: "assignedToId is required" }, { status: 400 });
      amlCase = await assignCase(id, organizationId, body.assignedToId, { userId });
    } else if (body.action === "escalate") {
      amlCase = await escalateCase(id, organizationId, body.notes, { userId });
    } else if (body.action === "resolve") {
      // Resolving requires the stricter aml.approve permission — re-check
      // here since this route is gated at aml.review for assign/escalate.
      const check = await requireTenant({ permission: "aml.approve" });
      amlCase = await resolveCase(id, organizationId, body, { userId: check.userId, role, canApprove: true });
    } else {
      return NextResponse.json({ error: "action must be 'assign', 'escalate', or 'resolve'" }, { status: 400 });
    }
    return NextResponse.json({ case: amlCase });
  } catch (err) {
    return mapAmlError(err, "AML_CASE_PATCH");
  }
}
