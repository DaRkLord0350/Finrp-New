import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapCreditError } from "@/lib/credit/http";
import { getReport } from "@/lib/credit/service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "credit.read" });
    const { id } = await params;
    const report = await getReport(id, organizationId);
    return NextResponse.json({ report });
  } catch (err) {
    return mapCreditError(err, "CREDIT_REPORT_GET");
  }
}
