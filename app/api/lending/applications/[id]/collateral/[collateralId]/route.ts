import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { recordValuation, markLienMarked, releaseCollateral } from "@/lib/lending/collateral";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; collateralId: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.write" });
    const { collateralId } = await params;
    const body = await req.json();

    let collateral;
    if (body.action === "value") {
      collateral = await recordValuation(collateralId, organizationId, { estimatedValue: body.estimatedValue, valuedBy: body.valuedBy }, { userId });
    } else if (body.action === "mark-lien") {
      collateral = await markLienMarked(collateralId, organizationId, body.lienReferenceNumber, { userId });
    } else if (body.action === "release") {
      collateral = await releaseCollateral(collateralId, organizationId, { userId });
    } else {
      return NextResponse.json({ error: "Unknown action — expected 'value', 'mark-lien', or 'release'" }, { status: 400 });
    }
    return NextResponse.json({ collateral });
  } catch (err) {
    return mapLendingError(err, "LENDING_COLLATERAL_PATCH");
  }
}
