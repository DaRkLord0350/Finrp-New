import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { recordPartPayment } from "@/lib/lending/foreclosure";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.collect" });
    const { id } = await params;
    const body = await req.json();
    const result = await recordPartPayment(id, organizationId, body, { userId });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_PART_PAYMENT");
  }
}
