// ============================================================
// FinRP — TBX Beneficiary: Verify
// POST /api/banking/beneficiaries/[vendorId]/verify
// Triggers bank-account verification for an existing TBX beneficiary.
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant, ForbiddenError, UnauthorizedError } from "@/lib/auth/require-tenant";
import { triggerBeneficiaryVerify, BeneficiaryActionError } from "@/lib/tbx/beneficiaries/beneficiary.routes";

export async function POST(_req: Request, { params }: { params: Promise<{ vendorId: string }> }) {
  try {
    const { organizationId, userId } = await requireTenant({ permission: "banking.write" });
    const { vendorId } = await params;

    const result = await triggerBeneficiaryVerify(organizationId, vendorId, userId);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof BeneficiaryActionError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[banking/beneficiaries/verify]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
