import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { recordCollectionActivity } from "@/lib/lending/collections";

export async function POST(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.collect" });
    const { caseId } = await params;
    const body = await req.json();
    const activity = await recordCollectionActivity(caseId, organizationId, body, { userId });
    return NextResponse.json({ activity }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_COLLECTION_ACTIVITY_POST");
  }
}
