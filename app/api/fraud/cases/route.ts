import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapFraudError } from "@/lib/fraud/http";
import { listCases } from "@/lib/fraud/case-service";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "fraud.read" });
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const cases = await listCases(organizationId, { status });
    return NextResponse.json({ cases });
  } catch (err) {
    return mapFraudError(err, "FRAUD_CASES_GET");
  }
}
