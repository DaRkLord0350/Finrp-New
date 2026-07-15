// ============================================================
// FinRP — TBX Beneficiary: Sync
// POST /api/banking/beneficiaries/[vendorId]/sync { force? }
// Refreshes beneficiary/verification/approval status from TBX.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireTenant, ForbiddenError, UnauthorizedError } from "@/lib/auth/require-tenant";
import { triggerBeneficiarySync, BeneficiaryActionError } from "@/lib/tbx/beneficiaries/beneficiary.routes";

export async function POST(req: NextRequest, { params }: { params: Promise<{ vendorId: string }> }) {
  try {
    const { organizationId, userId } = await requireTenant({ permission: "banking.write" });
    const { vendorId } = await params;
    const body = await req.json().catch(() => ({}));

    const result = await triggerBeneficiarySync(organizationId, vendorId, userId, { force: Boolean(body?.force) });
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof BeneficiaryActionError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[banking/beneficiaries/sync]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
