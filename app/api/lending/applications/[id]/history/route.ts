import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { getApplicationHistory } from "@/lib/lending/workflow/service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const history = await getApplicationHistory(id, organizationId);
    return NextResponse.json({ history });
  } catch (err) {
    return mapLendingError(err, "LENDING_APPLICATION_HISTORY");
  }
}
