import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { listRepayments, recordManualRepayment } from "@/lib/lending/repayment";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const repayments = await listRepayments(id, organizationId);
    return NextResponse.json({ repayments });
  } catch (err) {
    return mapLendingError(err, "LENDING_REPAYMENTS_GET");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.collect" });
    const { id } = await params;
    const body = await req.json();
    const repayment = await recordManualRepayment(id, organizationId, body, { userId });
    return NextResponse.json({ repayment }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_REPAYMENTS_POST");
  }
}
