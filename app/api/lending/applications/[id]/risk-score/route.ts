import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { scoreAndAdvanceToApproval } from "@/lib/lending/underwriting";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.write" });
    const { id } = await params;
    const extraSignals = await req.json().catch(() => ({}));
    const result = await scoreAndAdvanceToApproval(id, organizationId, extraSignals, { userId, role });
    return NextResponse.json({ risk: result });
  } catch (err) {
    return mapLendingError(err, "LENDING_RISK_SCORE");
  }
}
