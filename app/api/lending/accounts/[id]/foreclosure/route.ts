import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { requestForeclosure } from "@/lib/lending/foreclosure";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.collect" });
    const { id } = await params;
    const foreclosure = await requestForeclosure(id, organizationId, { userId });
    return NextResponse.json({ foreclosure }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_FORECLOSURE_REQUEST");
  }
}
