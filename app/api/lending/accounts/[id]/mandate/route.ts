import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { registerAutoDebitMandate, cancelAutoDebitMandate } from "@/lib/lending/repayment";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.collect" });
    const { id } = await params;
    const body = await req.json();
    const account = await registerAutoDebitMandate(id, organizationId, body, { userId });
    return NextResponse.json({ account }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_MANDATE_POST");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.collect" });
    const { id } = await params;
    const account = await cancelAutoDebitMandate(id, organizationId, { userId });
    return NextResponse.json({ account });
  } catch (err) {
    return mapLendingError(err, "LENDING_MANDATE_DELETE");
  }
}
