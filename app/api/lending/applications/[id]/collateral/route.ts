import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { listCollateral, addCollateral } from "@/lib/lending/collateral";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const collateral = await listCollateral(id, organizationId);
    return NextResponse.json({ collateral });
  } catch (err) {
    return mapLendingError(err, "LENDING_COLLATERAL_GET");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.write" });
    const { id } = await params;
    const body = await req.json();
    const collateral = await addCollateral(id, organizationId, body, { userId });
    return NextResponse.json({ collateral }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_COLLATERAL_POST");
  }
}
