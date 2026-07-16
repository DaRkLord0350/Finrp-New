import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapMonitoringError } from "@/lib/monitoring/http";
import { listCases } from "@/lib/monitoring/case-service";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "monitoring.read" });
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") ?? undefined;
    const cases = await listCases(organizationId, { status });
    return NextResponse.json({ cases });
  } catch (err) {
    return mapMonitoringError(err, "MONITORING_CASES_GET");
  }
}
