import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { approveForeclosure, completeForeclosure } from "@/lib/lending/foreclosure";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.approve" });
    const { id } = await params;
    const { action, waiveCharges } = await req.json();

    const foreclosure =
      action === "approve"
        ? await approveForeclosure(id, organizationId, { waiveCharges }, { userId })
        : action === "complete"
          ? await completeForeclosure(id, organizationId, { userId })
          : null;
    if (!foreclosure) return NextResponse.json({ error: "action must be 'approve' or 'complete'" }, { status: 400 });
    return NextResponse.json({ foreclosure });
  } catch (err) {
    return mapLendingError(err, "LENDING_FORECLOSURE_PATCH");
  }
}
