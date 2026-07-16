import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { assignCase, resolveCase, escalateCase } from "@/lib/lending/collections";

export async function PATCH(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.collect" });
    const { caseId } = await params;
    const { action, assignedToId } = await req.json();

    let collectionCase;
    if (action === "assign") {
      if (!assignedToId) return NextResponse.json({ error: "assignedToId is required" }, { status: 400 });
      collectionCase = await assignCase(caseId, organizationId, assignedToId, { userId });
    } else if (action === "resolve") {
      collectionCase = await resolveCase(caseId, organizationId, { userId });
    } else if (action === "escalate") {
      collectionCase = await escalateCase(caseId, organizationId, { userId });
    } else {
      return NextResponse.json({ error: "action must be 'assign', 'resolve', or 'escalate'" }, { status: 400 });
    }
    return NextResponse.json({ case: collectionCase });
  } catch (err) {
    return mapLendingError(err, "LENDING_COLLECTION_CASE_PATCH");
  }
}
