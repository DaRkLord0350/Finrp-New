import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapFraudError } from "@/lib/fraud/http";
import { removeListEntry } from "@/lib/fraud/list-service";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "fraud.manage" });
    const { id } = await params;
    await removeListEntry(id, organizationId, { userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    return mapFraudError(err, "FRAUD_LIST_DELETE");
  }
}
