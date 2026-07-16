import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { getEmiSchedule } from "@/lib/lending/repayment";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const schedule = await getEmiSchedule(id, organizationId);
    return NextResponse.json({ schedule });
  } catch (err) {
    return mapLendingError(err, "LENDING_ACCOUNT_SCHEDULE");
  }
}
